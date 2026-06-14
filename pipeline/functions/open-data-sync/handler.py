# stub handler — placeholder until function is implemented
import logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    logger.info(f"Stub handler invoked — not yet implemented")
    logger.info(f"Event: {event}")
    return {"statusCode": 200, "body": "stub"}