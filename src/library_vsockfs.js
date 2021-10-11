mergeInto(LibraryManager.library, {
  $VSOCKFS__postset: function() {
    addAtInit('VSOCKFS.root = FS.mount(VSOCKFS, {}, null);');
  },
  $VSOCKFS__deps: ['$FS'],
  $VSOCKFS: {
    mount: function(mount) {
      globalThis.vSockFsEventBus = new EventTarget();
      globalThis.sockets = [];
      globalThis.makeRequest = function(requestContent) {
        var newRequestEvent = new Event('request');
        globalThis.sockets.forEach(socket => {
          socket.recv_queue.push({ addr: '127.0.0.1', port: '12345', data: requestContent });
          // socket.eventTarget.dispatchEvent(newRequestEvent);
        });
        globalThis.vSockFsEventBus.dispatchEvent(newRequestEvent);
      };
      return FS.createNode(null, '/', {{{ cDefine('S_IFDIR') }}} | 0o777 /* 0777 */, 0);
    },
    createSocket: function(family, type, protocol) {
      type &= ~{{{ cDefine('SOCK_CLOEXEC') | cDefine('SOCK_NONBLOCK') }}}; // Some applications may pass it; it makes no sense for a single process.
      var streaming = type == {{{ cDefine('SOCK_STREAM') }}};
      if (protocol) {
        assert(streaming == (protocol == {{{ cDefine('IPPROTO_TCP') }}})); // if SOCK_STREAM, must be tcp
      }

      // create our internal socket structure
      var sock = {
        family: family,
        type: type,
        protocol: protocol,
        server: null,
        error: null, // Used in getsockopt for SOL_SOCKET/SO_ERROR test
        peers: {},
        pending: [],
        recv_queue: [],
        sock_ops: VSOCKFS.sock_ops,
        eventTarget: new EventTarget(),
        socketType: 'listensock',
      };

      // create the filesystem node to store the socket structure
      var name = VSOCKFS.nextname();
      var node = FS.createNode(VSOCKFS.root, name, {{{ cDefine('S_IFSOCK') }}}, 0);
      node.sock = sock;

      // and the wrapping stream that enables library functions such
      // as read and write to indirectly interact with the socket
      var stream = FS.createStream({
        path: name,
        node: node,
        flags: {{{ cDefine('O_RDWR') }}},
        seekable: false,
        stream_ops: VSOCKFS.stream_ops
      });

      // map the new stream to the socket structure (sockets have a 1:1
      // relationship with a stream)
      sock.stream = stream;

      globalThis.sockets.push(sock);
      return sock;
    },
    stream_ops: {
      poll: function(stream) {
        var sock = stream.node.sock;
        return sock.sock_ops.poll(sock);
      },
      ioctl: function(stream, request, varargs) {
        var sock = stream.node.sock;
        return sock.sock_ops.ioctl(sock, request, varargs);
      },
      read: function(stream, buffer, offset, length, position /* ignored */) {
        var sock = stream.node.sock;
        var msg = sock.sock_ops.recvmsg(sock, length);
        if (!msg) {
          // socket is closed
          return 0;
        }
        buffer.set(msg.buffer, offset);
        return msg.buffer.length;
      },
      write: function(stream, buffer, offset, length, position /* ignored */) {
        var sock = stream.node.sock;
        return sock.sock_ops.sendmsg(sock, buffer, offset, length);
      },
      close: function(stream) {
        var sock = stream.node.sock;
        sock.sock_ops.close(sock);
      }
    },
    sock_ops: {
      recvmsg: function(sock, length) {
        var queued = sock.recv_queue.shift();
        if (!queued) {
          if (sock.type === {{{ cDefine('SOCK_STREAM') }}}) {
            // var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);

            // if (!dest) {
            //   // if we have a destination address but are not connected, error out
            //   throw new FS.ErrnoError({{{ cDefine('ENOTCONN') }}});
            // }
            // else if (dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
            //   // return null if the socket has closed
            //   return null;
            // }
            // else {
              // else, our socket is in a valid state but truly has nothing available
              throw new FS.ErrnoError({{{ cDefine('EAGAIN') }}});
            // }
          } else {
            throw new FS.ErrnoError({{{ cDefine('EAGAIN') }}});
          }
        }

        // queued.data will be an ArrayBuffer if it's unadulterated, but if it's
        // requeued TCP data it'll be an ArrayBufferView
        var queuedLength = queued.data.byteLength || queued.data.length;
        var queuedOffset = queued.data.byteOffset || 0;
        var queuedBuffer = queued.data.buffer || queued.data;
        var bytesRead = Math.min(length, queuedLength);
        var res = {
          buffer: new Uint8Array(queuedBuffer, queuedOffset, bytesRead),
          addr: queued.addr,
          port: queued.port
        };

        out('read (' + bytesRead + ' bytes): ' + [Array.prototype.slice.call(res.buffer)]);

        // push back any unread data for TCP connections
        if (sock.type === {{{ cDefine('SOCK_STREAM') }}} && bytesRead < queuedLength) {
          var bytesRemaining = queuedLength - bytesRead;
          out('read: put back ' + bytesRemaining + ' bytes');
          queued.data = new Uint8Array(queuedBuffer, queuedOffset + bytesRead, bytesRemaining);
          sock.recv_queue.unshift(queued);
        }

        return res;
      },
      sendmsg: function(sock, buffer, offset, length) {
        var dataToSend = new Uint8Array(buffer.buffer, offset, length);
        console.log('send():', dataToSend, new TextDecoder().decode(dataToSend));
        return length;
      },
      close: function() {
        debugger
      },
      ioctl: function(sock, request, arg) {
        // debugger
        return 0;
      },
      bind: function(sock, addr, port) {
        return 0;
      },
      listen: function(sock, backlog) {
        return 0;
      },
      poll: function(sock) {
        var mask = 0;
        if (sock.recv_queue.length) {
          mask |= ({{{ cDefine('POLLRDNORM') }}} | {{{ cDefine('POLLIN') }}});
        }
        // if (sock.socketType === 'readsock') {
        //   return mask;
        // }
        // if (mask && Asyncify.state !== Asyncify.State.Rewinding) {  // nonzero; while rewinding return the result of Asyncify.handleSleep
        //   return mask;
        // }
        // return Asyncify.handleSleep(function(wakeUp) {
        //   sock.eventTarget.addEventListener('request', (e) => {
            // e.onRequest();
            // if (sock.recv_queue.length) {
            //   mask |= ({{{ cDefine('POLLRDNORM') }}} | {{{ cDefine('POLLIN') }}});
            // }
            // return wakeUp(mask);
          // });
        // });
        return mask;
      },
      accept: function(listensock) {
        if (!listensock.recv_queue.length) {
          throw new FS.ErrnoError({{{ cDefine('EINVAL') }}});
        }
        var newsock = VSOCKFS.createSocket(listensock.family, listensock.type, listensock.protocol);
        newsock.daddr = '127.0.0.1';
        newsock.dport = '12345';
        newsock.socketType = 'readsock';
        newsock.recv_queue.push(listensock.recv_queue.shift());

        newsock.stream.flags = listensock.stream.flags;
        return newsock;
      },
    },
    nextname: function() {
      if (!VSOCKFS.nextname.current) {
        VSOCKFS.nextname.current = 0;
      }
      return 'socket[' + (VSOCKFS.nextname.current++) + ']';
    },
    getSocket: function(fd) {
      var stream = FS.getStream(fd);
      if (!stream || !FS.isSocket(stream.node.mode)) {
        return null;
      }
      return stream.node.sock;
    },
  },
});
