from tenacity import retry, wait_exponential, stop_after_attempt

@retry(
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(4)
)
def fetch_er_data(url):
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    return response.text