import urllib.request
import urllib.error

url = "https://anakot-agent-production.up.railway.app/api/model/options"
req = urllib.request.Request(url, headers={"X-Anakot-Session-Token": "test"})
try:
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Body:", response.read().decode())
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code)
    print("Body:", e.read().decode())
except Exception as e:
    print("Exception:", e)
