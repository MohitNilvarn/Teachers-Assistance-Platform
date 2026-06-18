import os
import re

def prefix_urls(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Prefix markdown links: [label](/path) -> [label](/path)
    # We use a negative lookahead to skip  and /src/assets/
    content = re.sub(r'\[([^\]]*)\]\((?!\|\/src\/assets)(\/.*?)\)', r'[\1](\2)', content)

    # Prefix HTML attributes: href="/path", src="/path", etc.
    # We match common attributes that take URLs.
    # We also handle both double and single quotes.
    def attr_sub(match):
        attr = match.group(1)
        quote = match.group(2)
        path = match.group(3)
        if path.startswith('') or path.startswith('/src/assets'):
            return match.group(0)
        return f'{attr}={quote}{path}{quote}'

    content = re.sub(r'(href|src|action|poster|data)=(["\'])(/.*?)\2', attr_sub, content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

docs_dir = 'src/content/docs'
for root, dirs, files in os.walk(docs_dir):
    for file in files:
        if file.endswith('.mdx'):
            file_path = os.path.join(root, file)
            print(f'Processing {file_path}...')
            prefix_urls(file_path)
