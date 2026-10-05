# -*- coding: utf-8 -*-
"""局域网共享启动器：手机与电脑连同一个 Wi-Fi，访问本脚本打印的地址即可。"""
import os, socket, subprocess, sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = 8347


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()


ip = lan_ip()
print('=' * 56)
print('  表达力训练营 · 手机访问模式已启动（关闭本窗口即停止）')
print()
print('  电脑访问 : http://127.0.0.1:%d' % PORT)
print('  手机访问 : http://%s:%d' % (ip, PORT))
print()
print('  1. 手机需与电脑连接同一个 Wi-Fi')
print('  2. 首次启动若 Windows 弹出防火墙提示，请点「允许访问」')
print('  3. 手机打不开？右键「放行端口.bat」以管理员身份运行一次')
print('  4. 局域网 http 下手机语音识别不可用（浏览器安全策略），')
print('     打字输入全功能可用；需要语音请看《手机使用指南.md》方案 B')
print('=' * 56)
subprocess.run([sys.executable, '-m', 'http.server', str(PORT), '--bind', '0.0.0.0'])
