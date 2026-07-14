"""
Shared helper for Sprint 17 Phase B load scripts (routing_shadow_eval,
cache_load_eval): fetch the protected /metrics endpoint and parse a
specific metric's current value out of Prometheus exposition-format text.

Reading a before/after snapshot and diffing is how both load scripts turn
a batch of fired requests into a metric, without any new backend endpoint
or Grafana/Loki read credentials.
"""
import requests


def fetch_metrics(base_url: str, token: str) -> str:
    resp = requests.get(
        f"{base_url}/metrics",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.text


def parse_metric_value(
    metrics_text: str, name: str, labels: dict[str, str] | None = None
) -> float:
    label_str = ""
    if labels:
        label_str = "{" + ",".join(f'{k}="{v}"' for k, v in labels.items()) + "}"
    prefix = f"{name}{label_str} "
    for line in metrics_text.splitlines():
        if line.startswith(prefix):
            return float(line.split()[-1])
    raise ValueError(f"metric {prefix!r} not found in metrics text")
