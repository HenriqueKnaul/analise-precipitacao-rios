"""Start the complete application, preserving any existing database."""
import argparse
import subprocess
import sys
import threading
import time
import webbrowser
from contextlib import closing
from pathlib import Path
from urllib.request import urlopen


def main():
    parser=argparse.ArgumentParser(description='Iniciar Chuva x Rio com banco e servidor local')
    parser.add_argument('--host',default='127.0.0.1',help='Endereço de escuta do servidor')
    parser.add_argument('--port',type=int,default=8000)
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    try:
        import uvicorn
    except ImportError:
        raise SystemExit('Instale as dependências: python -m pip install -r requirements.txt')
    from app.db import connect, initialize
    with closing(connect()) as db:
        initialize(db)
        empty=not db.execute('SELECT 1 FROM ingestion LIMIT 1').fetchone()
    if empty:
        subprocess.run([sys.executable,'-m','app.cli','demo'],cwd=Path(__file__).parent,check=True)
    browser_host={'0.0.0.0':'127.0.0.1','::':'::1'}.get(args.host,args.host)
    if ':' in browser_host:
        browser_host=f'[{browser_host}]'
    url=f'http://{browser_host}:{args.port}/'
    print(f'Chuva x Rio: {url}\nMantenha este terminal aberto. Ctrl+C encerra.',flush=True)
    if not args.no_browser:
        def open_ready():
            for _ in range(40):
                try:
                    with urlopen(url+'api/catalog',timeout=1) as response:
                        if response.status==200:
                            webbrowser.open(url)
                            return
                except OSError:
                    time.sleep(.25)
        threading.Thread(target=open_ready,daemon=True).start()
    uvicorn.run('app.main:app',host=args.host,port=args.port)


if __name__=='__main__':
    main()
