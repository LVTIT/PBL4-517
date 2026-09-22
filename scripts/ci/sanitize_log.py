"""Print CI diagnostics without environment credentials or session material."""
import os
from pathlib import Path
import re
import sys


def sanitize(text):
    for name in ('DATABASE_URL', 'SESSION_SECRET', 'POSTGRES_PASSWORD'):
        value = os.environ.get(name)
        if value:
            text = text.replace(value, '[REDACTED]')
    text = re.sub(r'(?i)postgres(?:ql)?://[^\s\'"<>]+', '[DATABASE_URL REDACTED]', text)
    text = re.sub(r'pbl517\.sid=[^\s\'";,]+', 'pbl517.sid=[REDACTED]', text)
    text = re.sub(r'\b[a-fA-F0-9]{64}\b', '[TOKEN REDACTED]', text)
    # Prevent diagnostic text from being interpreted as a workflow command.
    return '\n'.join('| ' + line for line in text.splitlines())


if __name__ == '__main__':
    path = Path(sys.argv[1])
    print(sanitize(path.read_text(encoding='utf-8', errors='replace')) if path.exists()
          else 'No backend log was created.')
