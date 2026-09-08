# =====================================================
# Workbench 一次性命令：把 MCU 公钥注入到 root 的 authorized_keys
# 默认 Workbench 登录的是 admin（无 root 权限），所以用 sudo 提权
# 执行后 SSH 密钥登录立刻可用，无需重启服务器
# =====================================================
# 操作：
#   1. 阿里云控制台 → 本实例 → 远程连接 → Workbench 一键连接 → 立即登录
#   2. 复制下面整段（多行），粘到终端回车
#   3. 看到 "==== KEY_INSTALLED ====" 即成功
#   4. 回我 "OK"

sudo bash -c 'mkdir -p /root/.ssh && chmod 700 /root/.ssh && cat >> /root/.ssh/authorized_keys << "EOF"
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDN5nCuWh62HeQnJZ+xyn3KwRA46pQvEnCDqw06dm/Z225wvQvCkKZXpdLiE6afKT93kgmiCxZXsLjH7vByCKNzHzOtLS1Ly96Ir0MSkk5aDK5+4SHWJlC0kUEcg+oDzyz234XT52sFEQ2qbHDbEsIaeAvcWlY6oYpkEDErf/ShK7OxAL764HZSbJlm3IE1RfVccKJSHRvsQLUhIv/1hJ5cmrZI6WOy6s9pv4+Yv9JDBnYa/DbkuwPuRxxmqt/xDb056y5kwNGPATTp4flevrIhsarZg3PlSe3EkZbcz6RG4CXSCRqhpFif/1n7f40OIHZsPa3RVvsmtZeKS1TkoYtj
EOF
chmod 600 /root/.ssh/authorized_keys
echo "==== KEY_INSTALLED ===="
wc -l /root/.ssh/authorized_keys
ls -la /root/.ssh/'

# 之后若需清掉这个临时文件，命令：rm -f ~/workbench-key-install.sh
