import os, re

js_dir = r'd:\Code Projects\OmniBank-Local\static\js'

def replace_in_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = re.sub(r'alert\(([\'\"`].*?[\'\"`])\)', r'showInlineMessage("Info", \1)', content)
    new_content = re.sub(r'if \(\s*confirm\((.*?)\)\s*\)', r'if (await showInlineConfirm("Confirmation", \1))', new_content)
    new_content = re.sub(r'return\s+showInlineMessage', r'return await showInlineMessage', new_content)

    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {os.path.basename(path)}")

for root, _, files in os.walk(js_dir):
    for f in files:
        if f.endswith('.js'):
            replace_in_file(os.path.join(root, f))
