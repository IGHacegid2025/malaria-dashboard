#!/usr/bin/env python3

import os

from random import randint

from http.server import HTTPServer
from http.server import SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    pass

# overrides the request handler to only print errors, not 200s
class QuieterRequestHandler(SimpleHTTPRequestHandler):
    def send_error(self, code, message=None, explain=None):
        # don't bother telling the user about Chrome nonsense
        if code == 404 and '.well-known/appspecific/com.chrome.devtools.json' in self.requestline:
            return
        super().send_error(code, message, explain)

    def log_request(self, code='-', size='-'):
        #print 'argh ' + str(code)
        if code != 200:
            self.log_message('"%s" %s %s',
                             self.requestline, str(code), str(size))
# port = randint(8000, 9000)
port = 9200  # ASCII L for Lookout
#dir = os.path.dirname(os.path.realpath(__file__)) + '/site'
dir = os.path.dirname(os.path.realpath(__file__))
os.chdir(dir)

# url = 'http://localhost:%d/%s' % (port, 'index.html')
# url = f'http://localhost:{port}/index.html'
url = f'http://localhost:{port}/'

# use to test non-minified version of source that lives in /js
#if os.path.exists('%s/js' % (dir)):
#   url = url + '?js'

print("serving at %s" % (url))

if __file__.endswith('.tool'):  # version for OS X
    os.system('open ' + url)
elif __file__.endswith('.py'):  # version for Windows
    os.system('start ' + url)  # use the default browser
    #os.system('start iexplore ' + url)  # use internet explorer
    #os.system('start iexplore -k ' + url)  # use kiosk mode


server_address = ('', port)
# use this version to not bother overriding the logging
#httpd = ThreadedHTTPServer(server_address, SimpleHTTPRequestHandler)
httpd = ThreadedHTTPServer(server_address, QuieterRequestHandler)
httpd.serve_forever()