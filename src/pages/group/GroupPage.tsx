import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { groupApi, userApi } from '../../api'
import { useAuthStore } from '../../store/authStore'
import { useChatStore } from '../../store/chatStore'
import type { Group, User } from '../../types'
import { getGroupConvId, getApiError } from '../../utils'
import { generateGroupKey, wrapGroupKey, unwrapGroupKey } from '../../crypto/e2e'
import { getPrivateKey, getOwnPublicKeyJwk } from '../../crypto/keyStore'
import { getPublicKey, setPublicKeys, fetchPublicKeyWithRetry } from '../../crypto/publicKeyCache'
import { setGroupKey, invalidateGroupKey } from '../../crypto/groupKeyCache'
import { sanitizeAvatarUrl } from '../../utils/sanitize'

export default function GroupPage() {
  const user = useAuthStore(s => s.user)!
  const { upsertConversation, clearConversation } = useChatStore()
  const navigate = useNavigate()

  const [groups, setGroups] = useState<Group[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [showInvite, setShowInvite] = useState<Group | null>(null)
  const [confirmLeave, setConfirmLeave] = useState<Group | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [onlineUsers, setOnlineUsers] = useState<User[]>([])
  const [error, setError] = useState('')
  const [leaveError, setLeaveError] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteMsgType, setInviteMsgType] = useState<'success' | 'warn' | 'error'>('success')
  const [creating, setCreating] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [inviteOpenCount, setInviteOpenCount] = useState(0)
  const [inviting, setInviting] = useState<number | null>(null)

  useEffect(() => {
    const mainContent = document.querySelector('.main-content') as HTMLElement | null
    if (mainContent) { mainContent.style.overflow = ''; mainContent.style.paddingBottom = '' }
    loadGroups()
  }, [])
  useEffect(() => {
    if (!showInvite) return
    groupApi.get(showInvite.id).then(r => {
      if (r.success) setShowInvite(r.data)
    }).catch(() => {})
    userApi.online().then(r => {
      if (r.success) {
        setOnlineUsers(r.data)
        setPublicKeys(r.data)
      }
    })
  // inviteOpenCount 每次打开弹窗时递增，确保每次都重新拉数据
  }, [inviteOpenCount])

  // 实时监听上线/下线，更新邀请弹窗的在线列表
  useEffect(() => {
    function onOnline(e: Event) {
      const { username } = (e as CustomEvent).detail
      userApi.getUserByUsername(username).then(res => {
        if (res.success) {
          setOnlineUsers(prev => {
            if (prev.some(u => u.username === username)) return prev
            setPublicKeys([res.data])
            return [...prev, res.data]
          })
        }
      }).catch(() => {})
    }
    function onOffline(e: Event) {
      const { username } = (e as CustomEvent).detail
      setOnlineUsers(prev => prev.filter(u => u.username !== username))
    }
    window.addEventListener('user-online', onOnline)
    window.addEventListener('user-offline', onOffline)
    return () => {
      window.removeEventListener('user-online', onOnline)
      window.removeEventListener('user-offline', onOffline)
    }
  }, [])

  // 被拉进新群（GROUP_MEMBER_ADDED）、群被解散（GROUP_DISSOLVED）、成员变动（GROUP_KEY_ROTATE）或 WS 重连后刷新群列表
  useEffect(() => {
    function onMemberAdded() { loadGroups() }
    function onDissolved(e: Event) {
      const { groupId } = (e as CustomEvent).detail
      if (groupId) setGroups(prev => prev.filter(g => g.id !== groupId))
      else loadGroups()
    }
    function onReconnected() { loadGroups() }
    function onMemberChanged(e: Event) {
      const { groupId } = (e as CustomEvent).detail
      loadGroups()
      // 若邀请弹窗正好开着且是同一个群，刷新 showInvite 的成员快照
      setShowInvite(prev => {
        if (prev && prev.id === groupId) {
          groupApi.get(groupId).then(r => { if (r.success) setShowInvite(r.data) }).catch(() => {})
        }
        return prev
      })
    }
    window.addEventListener('group-member-added', onMemberAdded)
    window.addEventListener('group-dissolved', onDissolved)
    window.addEventListener('ws-reconnected', onReconnected)
    window.addEventListener('group-member-changed', onMemberChanged)
    return () => {
      window.removeEventListener('group-member-added', onMemberAdded)
      window.removeEventListener('group-dissolved', onDissolved)
      window.removeEventListener('ws-reconnected', onReconnected)
      window.removeEventListener('group-member-changed', onMemberChanged)
    }
  }, [])

  async function loadGroups() {
    try {
      const res = await groupApi.list()
      if (res.success) setGroups(res.data)
    } catch { }
  }

  async function createGroup() {
    if (!newGroupName.trim() || creating) return
    setError('')
    if (newGroupName.trim().length > 100) { setError('群组名称不能超过 100 个字符'); return }
    setCreating(true)
    try {
      const res = await groupApi.create(newGroupName.trim())
      if (!res.success) { setError(res.message ?? '创建失败'); return }

      const group = res.data
      // 创建群后立即生成群密钥，并用自己的公钥包装后上传（自己作为第一个成员）
      const myPrivKey = await getPrivateKey(user.username)
      const myPubKey = await getOwnPublicKeyJwk(user.username)
      if (myPrivKey && myPubKey) {
        const groupKey = await generateGroupKey()
        const wrapped = await wrapGroupKey(groupKey, myPubKey, myPrivKey)
        await groupApi.uploadGroupKey(group.id, user.username, wrapped, user.username)
        setGroupKey(group.id, groupKey)
      }

      setGroups(g => [group, ...g])
      setShowCreate(false)
      setNewGroupName('')
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setCreating(false)
    }
  }

  async function inviteMember(group: Group, targetUser: User) {
    if (inviting !== null) return
    setInviteMsg('')
    setInviting(targetUser.id)
    try {
      await groupApi.invite(group.id, targetUser.id)
      const myPrivKey = await getPrivateKey(user.username)
      const myOwnPubKey = await getOwnPublicKeyJwk(user.username)
      // 对方可能尚未完成 initSession（公钥未上传），重试几次等待
      const memberPubKey = await fetchPublicKeyWithRetry(targetUser.username)
      const myGroupKeyRes = await groupApi.getMyGroupKey(group.id)
      if (myPrivKey && memberPubKey && myGroupKeyRes.success && myGroupKeyRes.data) {
        const pipeIdx = myGroupKeyRes.data.lastIndexOf('|')
        const encryptedKey = myGroupKeyRes.data.slice(0, pipeIdx)
        const wrappedBy = myGroupKeyRes.data.slice(pipeIdx + 1)
        // 若 wrappedBy 是自己，直接用本地 IDB 公钥，避免从服务器重拉后 JWK 字段差异导致 ECDH 不一致
        const wrapperPubKey = wrappedBy === user.username ? myOwnPubKey : await getPublicKey(wrappedBy)
        if (wrapperPubKey) {
          const groupKey = await unwrapGroupKey(encryptedKey, wrapperPubKey, myPrivKey)
          const wrapped = await wrapGroupKey(groupKey, memberPubKey, myPrivKey)
          await groupApi.uploadGroupKey(group.id, targetUser.username, wrapped, user.username)
          setInviteMsgType('success')
          setInviteMsg(`已成功邀请 ${targetUser.nickname || targetUser.username}`)
        } else {
          setInviteMsgType('warn')
          setInviteMsg(`已邀请 ${targetUser.nickname || targetUser.username}，但密钥分发失败，对方可能无法发送加密消息`)
        }
      } else if (!memberPubKey) {
        setInviteMsgType('warn')
        setInviteMsg(`已邀请 ${targetUser.nickname || targetUser.username}，但对方尚未设置加密，暂时无法发送群消息`)
      } else {
        setInviteMsgType('success')
        setInviteMsg(`已成功邀请 ${targetUser.nickname || targetUser.username}`)
      }
      // 刷新群列表，同时更新 showInvite 为最新成员数据
      const res = await groupApi.list()
      if (res.success) {
        setGroups(res.data)
        const updated = res.data.find(g => g.id === group.id)
        if (updated) setShowInvite(updated)
      }
    } catch (err) {
      setInviteMsgType('error')
      setInviteMsg(getApiError(err))
    } finally {
      setInviting(null)
    }
  }

  async function leaveGroup(group: Group) {
    if (leaving) return
    setLeaveError('')
    setLeaving(true)
    try {
      await groupApi.leave(group.id)
      invalidateGroupKey(group.id)
      clearConversation(getGroupConvId(group.name))
      setGroups(g => g.filter(gr => gr.id !== group.id))
      setConfirmLeave(null)
    } catch (err) {
      setLeaveError(getApiError(err))
    } finally {
      setLeaving(false)
    }
  }

  function openGroupChat(group: Group) {
    const convId = getGroupConvId(group.name)
    upsertConversation({
      id: convId,
      type: 'group',
      targetUsername: group.name,
      targetNickname: null,
      targetAvatar: group.avatar,
      groupId: group.id,
      lastMessage: null,
      lastMessageTime: null,
      unreadCount: 0,
      updatedAt: Date.now(),
    })
    navigate(`/chat/${convId}`, {
      state: {
        groupId: group.id,
        conv: {
          id: convId,
          type: 'group',
          targetUsername: group.name,
          targetNickname: null,
          targetAvatar: group.avatar,
          groupId: group.id,
        },
      },
    })
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>群组</h2>
        <button className="btn-icon-text" onClick={() => setShowCreate(true)}>+ 创建</button>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>创建群组</h3>
            <input
              type="text"
              placeholder="群组名称"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createGroup()}
              maxLength={100}
            />
            {error && <div className="form-error">{error}</div>}
            <div className="modal-actions">
              <button className="btn-primary" onClick={createGroup} disabled={creating}>
                {creating ? '创建中...' : '创建'}
              </button>
              <button onClick={() => setShowCreate(false)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {confirmLeave && (
        <div className="modal-overlay" onClick={() => { setConfirmLeave(null); setLeaveError('') }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {confirmLeave.owner.username === user.username
              ? <h3>解散群组</h3>
              : <h3>退出群组</h3>
            }
            <p style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 12 }}>
              {confirmLeave.owner.username === user.username
                ? `你是群主，退出将解散「${confirmLeave.name}」，所有成员将被移出且无法恢复。`
                : `确定退出「${confirmLeave.name}」？退出后该群的所有聊天记录将从本设备清除。`
              }
            </p>
            {leaveError && <div className="form-error">{leaveError}</div>}
            <div className="modal-actions">
              <button className="btn-danger" onClick={() => leaveGroup(confirmLeave)} disabled={leaving}>
                {leaving
                  ? (confirmLeave.owner.username === user.username ? '解散中...' : '退出中...')
                  : (confirmLeave.owner.username === user.username ? '确定解散' : '确定退出')
                }
              </button>
              <button onClick={() => { setConfirmLeave(null); setLeaveError('') }}>取消</button>
            </div>
          </div>
        </div>
      )}

      {showInvite && (
        <div className="modal-overlay" onClick={() => { setShowInvite(null); setInviteMsg(''); setInviteMsgType('success') }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>邀请在线用户加入「{showInvite.name}」</h3>
            {inviteMsg && (
              <div className={`invite-msg invite-msg-${inviteMsgType}`} style={{ marginBottom: 8 }}>
                {inviteMsg}
              </div>
            )}
            <div className="list">
              {onlineUsers
                .filter(u => u.id !== user.id && !showInvite.members.find(m => m.username === u.username))
                .map(u => (
                  <div key={u.id} className="list-item">
                    <div className="avatar">
                      {u.avatar
                        ? <img src={sanitizeAvatarUrl(u.avatar)} alt="" />
                        : <span>{(u.nickname || u.username)[0].toUpperCase()}</span>}
                      <span className="online-dot" />
                    </div>
                    <div className="list-item-body">
                      <span className="list-item-name">{u.nickname || u.username}</span>
                    </div>
                    <button className="btn-sm btn-primary" onClick={() => inviteMember(showInvite, u)} disabled={inviting === u.id}>
                      {inviting === u.id ? '邀请中...' : '邀请'}
                    </button>
                  </div>
                ))}
              {onlineUsers.filter(u => u.id !== user.id && !showInvite.members.find(m => m.username === u.username)).length === 0 && (
                <div className="empty-state"><p>暂无可邀请的在线用户</p></div>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => { setShowInvite(null); setInviteMsg(''); setInviteMsgType('success') }}>关闭</button>
            </div>
          </div>
        </div>
      )}

      <div className="list">
        {groups.length === 0 && (
          <div className="empty-state">
            <p>暂无群组</p>
            <p className="empty-hint">创建群组或等待被邀请</p>
          </div>
        )}
        {groups.map(g => (
          <div key={g.id} className="list-item" onClick={() => openGroupChat(g)}>
            <div className="avatar">
              {g.avatar && sanitizeAvatarUrl(g.avatar) ? <img src={sanitizeAvatarUrl(g.avatar)} alt="" /> : <span>{g.name[0].toUpperCase()}</span>}
              <span className="avatar-badge">群</span>
            </div>
            <div className="list-item-body">
              <span className="list-item-name">{g.name}</span>
              <span className="list-item-sub">{g.memberCount} 名成员</span>
            </div>
            <div className="btn-group" onClick={e => e.stopPropagation()}>
              <button className="btn-sm" onClick={() => { setShowInvite(g); setInviteOpenCount(c => c + 1) }}>邀请</button>
              <button className="btn-sm btn-danger" onClick={() => { setConfirmLeave(g); setLeaveError('') }}>退出</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}