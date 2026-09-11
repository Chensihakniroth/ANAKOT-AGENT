@echo off
set "BPP_DEBUG=1"
"D:\School\PROJECT\anakot-agent-home\anakot-agent\venv\Scripts\python.exe" "C:\Users\Niroth\.bigpickle\bigpickle_proxy.py" --mode cloud --port 8000 >> "C:\Users\Niroth\.bigpickle\logs\proxy.out.log" 2>> "C:\Users\Niroth\.bigpickle\logs\proxy.err.log"