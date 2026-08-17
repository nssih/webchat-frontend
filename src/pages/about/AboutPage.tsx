import { useNavigate } from 'react-router-dom'

export default function AboutPage() {
  const navigate = useNavigate()

  return (
    <div className="page">
      <div className="page-header">
        <button className="icon-btn" onClick={() => navigate(-1)}>←</button>
        <h2>关于 WebChat</h2>
        <div style={{ width: 36 }} />
      </div>

      <div className="about-body">

        {/* 一句话定位 */}
        <div className="about-hero">
          <div className="about-hero-icon">💬</div>
          <h1 className="about-hero-title">WebChat</h1>
          <p className="about-hero-sub">隐私优先的即时通讯工具</p>
          <p className="about-hero-desc">
            你们聊了什么，除了你们自己，任何人都看不到——<br />
            包括搭建这个服务器的人。
          </p>
        </div>

        {/* 消息安全 */}
        <div className="about-section">
          <h2 className="about-section-title">🔒 消息安全吗？</h2>

          <div className="about-card about-card-highlight">
            <p className="about-card-lead">服务器上没有你的任何聊天内容。</p>
            <p className="about-card-text">
              消息在离开你的手机之前就已经被加密成一串乱码，服务器拿到的是乱码，转发出去的也是乱码。
              对方收到后，用只有他自己才有的"钥匙"还原成原文。全程服务器看不懂任何内容。
            </p>
          </div>

          <div className="about-compare">
            <div className="about-compare-col bad">
              <div className="about-compare-label">普通聊天工具</div>
              <ul className="about-compare-list">
                <li>消息存在运营商服务器</li>
                <li>服务器被黑记录可能泄露</li>
                <li>账号被盗历史消息全暴露</li>
                <li>文件先传到服务器再下载</li>
              </ul>
            </div>
            <div className="about-compare-col good">
              <div className="about-compare-label">WebChat</div>
              <ul className="about-compare-list">
                <li>服务器只转发，不存储</li>
                <li>服务器拿到的全是密文</li>
                <li>私钥存你设备，别人打不开</li>
                <li>文件直接传给对方，不经存储</li>
              </ul>
            </div>
          </div>

          <div className="about-card">
            <p className="about-card-label">用一个比喻来理解</p>
            <p className="about-card-text">
              想象你寄一封信。普通工具就像邮局可以拆开看、留复印件再封好寄出。
              WebChat 是你把信锁进一个只有你和对方能打开的箱子，
              邮局只负责把箱子送到，全程不知道里面是什么。
            </p>
          </div>
        </div>

        {/* 聊天记录存哪 */}
        <div className="about-section">
          <h2 className="about-section-title">📱 聊天记录存在哪？</h2>
          <div className="about-card">
            <p className="about-card-text">
              聊天记录只存在<strong>你自己的设备</strong>上（浏览器本地存储），服务器里没有一条。
            </p>
            <ul className="about-tip-list">
              <li>换设备后历史消息不会同步过去——这是故意的，保护你的隐私</li>
              <li>清除浏览器数据（IndexedDB）会一并删除本地聊天记录和加密密钥，清除后历史消息无法找回，且需要重新登录生成新密钥</li>
              <li>同一账号在多台设备登录，新消息会同步推送到每台设备</li>
            </ul>
          </div>
        </div>

        {/* 功能介绍 */}
        <div className="about-section">
          <h2 className="about-section-title">✨ 都有哪些功能</h2>

          <div className="about-feature-list">
            <div className="about-feature">
              <span className="about-feature-icon">💬</span>
              <div>
                <div className="about-feature-name">私聊</div>
                <div className="about-feature-desc">点击「在线」里任意一人，发起一对一加密对话。支持文字（最多 5000 字）、图片、任意格式文件。消息有五种状态：发送中(○)→已发送(✓)→已送达(✓✓灰)→已读(✓✓蓝)→失败(✗)。</div>
              </div>
            </div>
            <div className="about-feature">
              <span className="about-feature-icon">👥</span>
              <div>
                <div className="about-feature-name">群聊</div>
                <div className="about-feature-desc">在「群组」页面创建群，群主邀请在线的人加入。群消息同样加密，服务器看不到内容。成员退出后群密钥自动轮换，退出成员无法读到新消息。发消息时在线成员实时收到，离线成员同时存一份加密暂存消息（最长 3 天），上线后自动补送。</div>
              </div>
            </div>
            <div className="about-feature">
              <span className="about-feature-icon">↩️</span>
              <div>
                <div className="about-feature-name">引用回复</div>
                <div className="about-feature-desc">右键单击（或移动端长按）任意消息，选择「回复」，发送后对方可以看到你在回复哪条消息。按 Esc 或点 ✕ 取消引用。</div>
              </div>
            </div>
            <div className="about-feature">
              <span className="about-feature-icon">📁</span>
              <div>
                <div className="about-feature-name">大文件传输（最大 2GB）</div>
                <div className="about-feature-desc">文件直接从你的设备传到对方设备，不经过服务器存储，每片 128KB 加密传输，边传边写盘，不占手机内存。传输中断后自动等待重连继续，无需重新发送。</div>
              </div>
            </div>
            <div className="about-feature">
              <span className="about-feature-icon">🟢</span>
              <div>
                <div className="about-feature-name">实时在线状态</div>
                <div className="about-feature-desc">谁上线谁下线，列表第一时间自动更新，不需要手动刷新。</div>
              </div>
            </div>
            <div className="about-feature">
              <span className="about-feature-icon">🔔</span>
              <div>
                <div className="about-feature-name">消息通知</div>
                <div className="about-feature-desc">切到其他页面时，标签页标题显示未读数。开启通知权限后，即使不看屏幕也能收到提醒。</div>
              </div>
            </div>
            <div className="about-feature">
              <span className="about-feature-icon">📲</span>
              <div>
                <div className="about-feature-name">安装到桌面</div>
                <div className="about-feature-desc">可以像 App 一样安装到手机主屏幕，全屏运行，体验和原生 App 一样。</div>
              </div>
            </div>
          </div>
        </div>

        {/* 消息状态 */}
        <div className="about-section">
          <h2 className="about-section-title">💬 消息状态说明</h2>
          <div className="about-card">
            <div className="about-status-list">
              <div className="about-status-row">
                <span className="about-status-icon">○</span>
                <div>
                  <div className="about-status-name">发送中</div>
                  <div className="about-status-desc">消息正在发送，等待服务器确认</div>
                </div>
              </div>
              <div className="about-status-row">
                <span className="about-status-icon">✓</span>
                <div>
                  <div className="about-status-name">已发送</div>
                  <div className="about-status-desc">服务器已转发，等待对方设备收到</div>
                </div>
              </div>
              <div className="about-status-row">
                <span className="about-status-icon">✓✓</span>
                <div>
                  <div className="about-status-name">已送达</div>
                  <div className="about-status-desc">对方设备已收到消息，但对方还未打开此聊天窗口</div>
                </div>
              </div>
              <div className="about-status-row">
                <span className="about-status-icon read">✓✓</span>
                <div>
                  <div className="about-status-name">已读</div>
                  <div className="about-status-desc">对方打开了这个聊天窗口，消息已被看到</div>
                </div>
              </div>
              <div className="about-status-row">
                <span className="about-status-icon">⏱</span>
                <div>
                  <div className="about-status-name">等待送达</div>
                  <div className="about-status-desc">对方当前不在线，消息已暂存服务器，对方上线后自动送达（最长保留 3 天）</div>
                </div>
              </div>
              <div className="about-status-row">
                <span className="about-status-icon failed">✗</span>
                <div>
                  <div className="about-status-name">失败 / 已过期</div>
                  <div className="about-status-desc">网络断开发送失败，或暂存超过 3 天对方仍未上线，需重新发送</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 怎么收发文件 */}
        <div className="about-section">
          <h2 className="about-section-title">📤 怎么发文件 / 收文件</h2>

          <div className="about-card">
            <p className="about-card-label">发文件</p>
            <ol className="about-step-list">
              <li>进入私聊页面，点输入框左边的 <strong>+</strong> 按钮</li>
              <li>选择要发送的文件（最大 2GB）</li>
              <li>超过 200MB 会有一个确认提示，确认后开始发送</li>
              <li>等对方点「接受」，传输自动开始，页面上有进度条</li>
              <li>传输过程中如果网络断开，自动等待重连后继续，无需重新发送</li>
            </ol>
          </div>

          <div className="about-card">
            <p className="about-card-label">收文件</p>
            <ol className="about-step-list">
              <li>收到文件请求时，聊天页顶部出现绿色横幅</li>
              <li>点「接受」，弹出一个"选择保存位置"的对话框</li>
              <li>选好保存位置，传输自动开始</li>
              <li>全部接收完毕后，页面提示「已保存到你选择的位置」</li>
            </ol>
          </div>

          <div className="about-tip">
            ⚠️ 传输过程中不要关闭页面或断网，如果网络临时断开，传输会在恢复后自动继续。
          </div>
        </div>

        {/* 安装到桌面 */}
        <div className="about-section">
          <h2 className="about-section-title">📲 怎么安装到手机桌面</h2>
          <div className="about-card">
            <p className="about-card-label">iPhone（Safari 浏览器）</p>
            <ol className="about-step-list">
              <li>用 Safari 打开 WebChat 网址</li>
              <li>点底部工具栏中间的「分享」按钮（方块加箭头的图标）</li>
              <li>向下滑找到「添加到主屏幕」，点击</li>
              <li>确认名称后点右上角「添加」</li>
            </ol>
          </div>
          <div className="about-card">
            <p className="about-card-label">Android（Chrome 浏览器）</p>
            <ol className="about-step-list">
              <li>用 Chrome 打开 WebChat 网址</li>
              <li>点右上角三个点的菜单</li>
              <li>选「添加到主屏幕」或「安装应用」</li>
              <li>确认后桌面出现图标，点开即用</li>
            </ol>
          </div>
        </div>

        {/* 常见问题 */}
        <div className="about-section">
          <h2 className="about-section-title">❓ 常见问题</h2>

          <div className="about-faq-list">
            <div className="about-faq">
              <div className="about-faq-q">打开页面后很久才能登录，显示"服务器正在唤醒"是什么意思？</div>
              <div className="about-faq-a">服务器有自动保活机制，正常情况下不会休眠。如果仍然遇到此提示，说明服务器正在从异常状态恢复，通常 10～30 秒内完成，倒计时结束后自动重试，不需要手动刷新。</div>
            </div>
            <div className="about-faq">
              <div className="about-faq-q">消息发出去显示"发送失败"怎么办？</div>
              <div className="about-faq-a">通常是网络断开导致的。检查网络后重新进入聊天页面，再发一次即可。</div>
            </div>
            <div className="about-faq">
              <div className="about-faq-q">对方一直显示不在线？</div>
              <div className="about-faq-a">对方可能没有打开 WebChat，或网络有问题。在线状态基于心跳检测，连续无响应会被判定为离线。</div>
            </div>
            <div className="about-faq">
              <div className="about-faq-q">历史消息不见了？</div>
              <div className="about-faq-a">可能是清除了浏览器数据，或者换了浏览器 / 设备。聊天记录只存本地，无法找回。</div>
            </div>
            <div className="about-faq">
              <div className="about-faq-q">换了手机还能用吗？</div>
              <div className="about-faq-a">账号可以在新设备登录，新设备会自动生成一套新的加密密钥并同步到服务器，可以正常收发新消息。但有两点需要注意：第一，旧设备上的聊天记录不会迁移到新设备；第二，新设备登录后服务器上的公钥被替换，旧设备的加密密钥与服务器不再匹配，旧设备将无法正常收发加密消息。建议换机后不再使用旧设备登录同一账号。</div>
            </div>
            <div className="about-faq">
              <div className="about-faq-q">有人能偷看我的消息吗？</div>
              <div className="about-faq-a">技术上不能。服务器管理员、黑客、网络运营商拿到的都是无法解读的密文。能看到消息原文的，只有你和你发消息的那个人。</div>
            </div>
            <div className="about-faq">
              <div className="about-faq-q">群主解散群后，我的聊天记录还在吗？</div>
              <div className="about-faq-a">服务器会删除群的结构信息，但你设备上已存储的聊天记录不受影响，除非你手动清除。</div>
            </div>
          </div>
        </div>

        {/* 隐私一览 */}
        <div className="about-section">
          <h2 className="about-section-title">🛡️ 服务器知道什么，不知道什么</h2>
          <div className="about-privacy-table">
            <div className="about-privacy-row header">
              <div className="about-privacy-col">服务器知道</div>
              <div className="about-privacy-col">服务器不知道</div>
            </div>
            <div className="about-privacy-row">
              <div className="about-privacy-col">你注册了一个账号</div>
              <div className="about-privacy-col">你和谁聊了什么</div>
            </div>
            <div className="about-privacy-row">
              <div className="about-privacy-col">你当前在线还是离线</div>
              <div className="about-privacy-col">你发了什么文件</div>
            </div>
            <div className="about-privacy-row">
              <div className="about-privacy-col">你的昵称和头像</div>
              <div className="about-privacy-col">群里聊了什么</div>
            </div>
            <div className="about-privacy-row">
              <div className="about-privacy-col">你在哪些群里</div>
              <div className="about-privacy-col">你的任何聊天历史</div>
            </div>
          </div>
          <div className="about-tip about-tip-primary">
            一句话：服务器只知道你在用这个工具，不知道你用它聊了什么。
          </div>
        </div>
      </div>
    </div>
  )
}
