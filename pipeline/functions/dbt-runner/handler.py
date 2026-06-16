import json
import logging
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# threading and multiprocessing must be imported and patched BEFORE dbt is
# imported. dbt module-level code captures bound-method references to the
# original multiprocessing primitives; those references bypass a later patch.
import threading
import multiprocessing
import multiprocessing.context
import multiprocessing.synchronize


def _patch_multiprocessing_for_lambda() -> None:
    """
    Lambda's sandbox blocks sem_open() so POSIX semaphore creation always fails.
    Patch at three layers to cover every import path dbt 1.11.x uses:
      Layer 1 — BaseContext methods  (mp_context.Lock())
      Layer 2 — multiprocessing module names  (multiprocessing.Lock())
      Layer 3 — synchronize classes directly  (from multiprocessing.synchronize import Lock)
    """
    # helpers accept (self, *a, **kw) so they work as instance methods (layer 1)
    # and as plain callables with ctx= kwarg (layers 2/3)
    def _lock(self_or_val=None, *a, **kw):     return threading.Lock()
    def _rlock(self_or_val=None, *a, **kw):    return threading.RLock()
    def _event(self_or_val=None, *a, **kw):    return threading.Event()
    def _condition(self_or_lock=None, **kw):   return threading.Condition(
        self_or_lock if isinstance(self_or_lock, (threading.Lock, threading.RLock)) else None
    )
    def _semaphore(self_or_val=1, *a, **kw):   return threading.Semaphore(
        self_or_val if isinstance(self_or_val, int) else 1
    )
    def _bsemaphore(self_or_val=1, *a, **kw):  return threading.BoundedSemaphore(
        self_or_val if isinstance(self_or_val, int) else 1
    )

    # Layer 1: patch BaseContext instance methods
    ctx = multiprocessing.context.BaseContext
    ctx.Lock             = lambda self, *a, **kw: threading.Lock()
    ctx.RLock            = lambda self, *a, **kw: threading.RLock()
    ctx.Event            = lambda self, *a, **kw: threading.Event()
    ctx.Condition        = lambda self, *a, **kw: threading.Condition()
    ctx.Semaphore        = lambda self, *a, **kw: threading.Semaphore()
    ctx.BoundedSemaphore = lambda self, *a, **kw: threading.BoundedSemaphore()

    # Layer 2: patch module-level callables (covers `import multiprocessing; multiprocessing.Lock()`)
    multiprocessing.Lock             = threading.Lock
    multiprocessing.RLock            = threading.RLock
    multiprocessing.Event            = threading.Event
    multiprocessing.Condition        = threading.Condition
    multiprocessing.Semaphore        = threading.Semaphore
    multiprocessing.BoundedSemaphore = threading.BoundedSemaphore

    # Layer 3: patch synchronize classes (covers `from multiprocessing.synchronize import Lock`)
    # These wrappers absorb the ctx= kwarg that synchronize passes internally.
    mp_sync = multiprocessing.synchronize
    mp_sync.Lock             = _lock
    mp_sync.RLock            = _rlock
    mp_sync.Event            = _event
    mp_sync.Condition        = _condition
    mp_sync.Semaphore        = _semaphore
    mp_sync.BoundedSemaphore = _bsemaphore


# MUST run before `from dbt.cli.main import dbtRunner` so that any bound-method
# references captured during dbt module initialization already see the threading
# substitutes instead of the broken POSIX semaphore implementation.
_patch_multiprocessing_for_lambda()

from dbt.cli.main import dbtRunner

logger = logging.getLogger()
logger.setLevel(logging.INFO)

DBT_PROJECT_DIR  = os.environ.get('DBT_PROJECT_DIR',  '/var/task/medicoord_dbt')
DBT_PROFILES_DIR = os.environ.get('DBT_PROFILES_DIR', '/var/task/medicoord_dbt')
DBT_TARGET_PATH  = '/tmp/dbt-target'
DBT_LOG_PATH     = '/tmp/dbt-logs'

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_KEY']

DEAD_TUPLE_WARN_PCT = 10


# ── dbt invocation ─────────────────────────────────────────────────────────

def _run_dbt(args: list[str]) -> tuple[int, str]:
    """
    Invoke dbt in-process using the dbtRunner API (dbt-core >= 1.5).
    Avoids subprocess PATH issues in Lambda — dbt logs flow to CloudWatch directly.
    Returns (rc, error_message).
    """
    full_args = [
        *args,
        '--project-dir',  DBT_PROJECT_DIR,
        '--profiles-dir', DBT_PROFILES_DIR,
        '--target-path',  DBT_TARGET_PATH,
        '--log-path',     DBT_LOG_PATH,
        '--no-use-colors',
    ]
    result = dbtRunner().invoke(full_args)
    rc  = 0 if result.success else 1
    err = str(result.exception) if result.exception else ''
    return rc, err


# ── result parsing ─────────────────────────────────────────────────────────

def _parse_results(results_path: str) -> dict:
    """
    Parse dbt run_results.json.
    Works for both `dbt run` (status: success/error) and
    `dbt test` (status: pass/fail/warn).
    """
    path = Path(results_path) / 'run_results.json'
    if not path.exists():
        logger.warning(f"run_results.json not found at {path}")
        return {'total': 0, 'passed': 0, 'failed': 0, 'details': []}

    with open(path) as f:
        data = json.load(f)

    results  = data.get('results', [])
    passed   = sum(1 for r in results if r.get('status') in ('success', 'pass'))
    failed   = sum(1 for r in results if r.get('status') in ('error', 'fail'))
    warnings = sum(1 for r in results if r.get('status') == 'warn')

    details = [
        {
            'node':     r.get('unique_id', ''),
            'status':   r.get('status'),
            'failures': r.get('failures'),          # test failure row count
            'message':  r.get('message', ''),
            'duration': round(r.get('execution_time', 0), 3),
        }
        for r in results
    ]

    return {
        'total':    len(results),
        'passed':   passed,
        'failed':   failed,
        'warnings': warnings,
        'details':  details,
    }


# ── db health checks via supabase rpc ──────────────────────────────────────

def _run_db_health_checks() -> dict:
    """
    Call medi_db_health_check() PostgreSQL RPC via PostgREST.
    The SQL function runs with SECURITY DEFINER so it can ANALYZE tables
    and read system catalogs without granting those privileges to the caller.
    """
    payload = json.dumps({}).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rpc/medi_db_health_check",
        data=payload,
        headers={
            'apikey':        SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type':  'application/json',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors='replace')
        raise RuntimeError(f"RPC medi_db_health_check failed {e.code}: {body}") from e

    warnings = []

    for row in data.get('dead_tuples', []):
        pct = float(row.get('dead_ratio_pct', 0))
        if pct > DEAD_TUPLE_WARN_PCT:
            warnings.append(f"dead_tuples:{row['table']}={pct}%")
            logger.warning(
                f"Dead tuple ratio on {row['table']}: {pct}% "
                f"({row.get('dead_tuples')} dead / {row.get('live_tuples')} live)"
            )
        else:
            logger.info(f"Dead tuples {row['table']}: {pct}%")

    long_queries = data.get('long_queries', [])
    if long_queries:
        warnings.append(f"long_queries:{len(long_queries)}")
        logger.warning(
            f"{len(long_queries)} long-running query(ies) detected (>30s): "
            f"{[r.get('pid') for r in long_queries]}"
        )
    else:
        logger.info("No long-running queries detected")

    deadlock_count = data.get('deadlocks', {}).get('count', 0)
    if deadlock_count > 0:
        warnings.append(f"deadlocks:{deadlock_count}")
        logger.warning(
            f"pg_stat_database reports {deadlock_count} deadlock(s) since last stats reset"
        )
    else:
        logger.info("Deadlock counter: 0")

    data['warnings'] = warnings
    data['overall']  = 'warn' if warnings else 'ok'
    return data


# ── handler ────────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    logger.info(f"dbt-runner triggered: {json.dumps(event)}")

    detail       = event.get('detail', {})
    processor    = detail.get('processor', 'unknown')
    record_count = detail.get('record_count', 0)
    logger.info(f"Upstream: {processor} processed {record_count} records")

    started_at = datetime.now(timezone.utc).isoformat()

    # ── step 1: dbt run ────────────────────────────────────────────────────
    logger.info("Phase 1 — dbt run")
    rc, err = _run_dbt(['run'])
    if err:
        logger.warning(f"dbt run error: {err}")

    run_summary = _parse_results(DBT_TARGET_PATH)
    logger.info(f"dbt run summary: {json.dumps(run_summary)}")

    if rc != 0:
        logger.error(
            f"dbt run failed — "
            f"{run_summary['failed']} model(s) errored, aborting test phase"
        )
        return {
            'statusCode': 500,
            'body': {
                'status':       'FAILURE',
                'phase':        'run',
                'run_summary':  run_summary,
                'test_summary': None,
                'processor':    processor,
                'started_at':   started_at,
                'completed_at': datetime.now(timezone.utc).isoformat(),
            },
        }

    # ── step 2: dbt test ───────────────────────────────────────────────────
    logger.info("Phase 2 — dbt test")
    rc, err = _run_dbt(['test'])
    if err:
        logger.warning(f"dbt test error: {err}")

    test_summary = _parse_results(DBT_TARGET_PATH)
    logger.info(f"dbt test summary: {json.dumps(test_summary)}")

    if test_summary['failed'] > 0:
        failed_nodes = [
            d['node'] for d in test_summary['details'] if d['status'] == 'fail'
        ]
        logger.error(f"dbt tests failed: {failed_nodes}")

    # ── phase 3: db health checks ──────────────────────────────────────────
    logger.info("Phase 3 — DB health checks (RPC)")
    try:
        db_health = _run_db_health_checks()
        logger.info(f"DB health: {json.dumps(db_health, default=str)}")
    except Exception as e:
        logger.error(f"DB health check RPC failed: {e}")
        db_health = {'overall': 'error', 'error': str(e)}

    has_test_failures = test_summary['failed'] > 0
    has_health_issues = db_health.get('overall') in ('warn', 'error')
    status       = 'DEGRADED' if (has_test_failures or has_health_issues) else 'SUCCESS'
    completed_at = datetime.now(timezone.utc).isoformat()

    logger.info(
        f"dbt-runner complete — "
        f"models {run_summary['passed']}/{run_summary['total']} ok | "
        f"tests {test_summary['passed']}/{test_summary['total']} passed | "
        f"db_health={db_health.get('overall')} | "
        f"status={status}"
    )

    return {
        'statusCode': 200,
        'body': {
            'status':       status,
            'processor':    processor,
            'run_summary':  run_summary,
            'test_summary': test_summary,
            'db_health':    db_health,
            'started_at':   started_at,
            'completed_at': completed_at,
        },
    }
