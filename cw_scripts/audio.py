import sys
import requests

base_url = "https://assets.quriousbit.com/codewords/audio/level_v0/level_{}.mp3"  # Change this to your API endpoint

error_responses = []

for i in range(30, 151):  # Change 21 to the number of times you want to hit the API
    url = base_url.format(i)
    print(f"Requesting {url}")
    try:
        response = requests.get(url, timeout=10)
        if not response.ok:
            print(f"Error for {url}: Status code {response.status_code}")
            error_responses.append((url, response.status_code, response.text))
    except Exception as e:
        print(f"Exception for {url}: {e}")
        error_responses.append((url, str(e)))

print("\nRequests with errors:")
for err in error_responses:
    print(err)