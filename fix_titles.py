import os
import re

directory = r'd:\Code Projects\OmniBank-Local\static\js\views'

for filename in os.listdir(directory):
    if filename.endswith('.js'):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        def repl(m):
            attrs = m.group(1)
            emoji_text = m.group(2)
            
            data_i18n_match = re.search(r'data-i18n="([^"]+)"', attrs)
            if data_i18n_match:
                key = data_i18n_match.group(1)
                new_attrs = re.sub(r'\s*data-i18n="[^"]+"', '', attrs)
                
                parts = emoji_text.split(' ', 1)
                if len(parts) == 2:
                    return f'<h2{new_attrs}>{parts[0]} <span data-i18n="{key}">{parts[1]}</span></h2>'
                else:
                    return f'<h2{new_attrs}><span data-i18n="{key}">{emoji_text}</span></h2>'
            return m.group(0)

        new_content = re.sub(r'<h2([^>]*)>(.*?)</h2>', repl, content)
        
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'Updated {filename}')
