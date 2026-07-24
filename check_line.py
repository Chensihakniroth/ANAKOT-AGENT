with open(r'D:\School\PROJECT\anakot-agent\WEB_VERSION\src\components\assistant-ui\streaming.test.tsx') as f:
    lines = f.readlines()
    line = lines[423]
    idx = line.find('```ts')
    if idx >= 0:
        chunk = line[idx:idx+35]
        print(repr(chunk))
