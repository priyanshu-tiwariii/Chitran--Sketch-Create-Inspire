'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Check, Link as LinkIcon, Mail, Users, Trash2, Pencil, MoreHorizontal } from 'lucide-react';
import axios from 'axios';
import { COLLAB_MODE_URL, COLLAB_URL } from '../lib/apiEndPoints';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { AlertModal } from "./AlertModal";
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../redux/store';
import { setCollaborativeRole, setIsCollaborative } from '../redux/collaborativeSlice';
import CanvasRestricted from './CanvasRestricted';
import { SingletonSocket } from '../lib/socket';
import * as Popover from '@radix-ui/react-popover';
import * as Tabs from '@radix-ui/react-tabs';

// --- TYPE DEFINITIONS ---
interface Collaborator {
  id: string; fileId: string; userId: string; role: string; joinedAt: string;
  user: { id: string; name: string; email: string; profilePhoto: string; };
}
const ROLES = [{ value: 'USER', label: 'Can View' }, { value: 'EDITOR', label: 'Can Edit' }];

// --- MAIN COMPONENT ---
const ShareButton = () => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error'>('success');
  const [showAlert, setShowAlert] = useState(false);
  
  const dispatch = useDispatch();
  const { collaborativeRole, isCollaborative } = useSelector((state: RootState) => state.collaborative);
  const params = useParams();
  const { data: session } = useSession();
  const fileId = params.fileId as string;
  const isCurrentUserAdmin = collaborativeRole === 'ADMIN';

  // --- API & DATA FETCHING LOGIC ---
  const fetchCollaborators = useCallback(async () => {
    try {
      const res = await axios.get(`${COLLAB_URL}/${fileId}`, {
        headers: { Authorization: `${session?.user?.token}` },
      });
      if (!res.data.success) throw new Error('Failed to fetch collaborators');
      const fetchedCollaborators: Collaborator[] = res.data.data;
      setCollaborators(fetchedCollaborators);
      const currentUser = fetchedCollaborators.find(c => c.userId === session?.user?.id);
      dispatch(setCollaborativeRole(currentUser?.role || 'USER'));
    } catch (error) {
      console.error("Failed to fetch collaborators:", error);
    }
  }, [fileId, session?.user?.id, session?.user?.token, dispatch]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const res = await axios.get(`${COLLAB_MODE_URL}/${fileId}`, {
          headers: { Authorization: `${session?.user?.token}` },
        });
        if (res.data.success && res.data.data) {
          dispatch(setIsCollaborative(true));
          await fetchCollaborators();
        } else {
          dispatch(setIsCollaborative(false));
        }
      } catch (error) {
        console.error('Error fetching initial collab status:', error);
      }
    };
    if (session?.user?.token) {
      fetchInitialData();
    }
  }, [fileId, session?.user?.token, dispatch, fetchCollaborators]);

  const handleAlert = (message: string, type: 'success' | 'error') => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
  };

  // --- ACTION HANDLERS ---
  const handleCollaborativeToggle = async () => {
    const newCollabState = !isCollaborative;
    try {
      const res = await axios.post(`${COLLAB_MODE_URL}/${fileId}`, { collabMode: newCollabState }, { headers: { Authorization: `${session?.user?.token}` } });
      if (!res.data.success) throw new Error(res.data.message);
      
      const socket = SingletonSocket.getInstance(session!.user!.token!);
      if (newCollabState) {
        if (!socket.connected) socket.connect();
        socket.emit('join-file', fileId, session!.user!.id!);
      }
      
      dispatch(setIsCollaborative(newCollabState));
      handleAlert(`Collaborative mode ${newCollabState ? 'enabled' : 'disabled'}.`, 'success');
      if (newCollabState) await fetchCollaborators(); else setCollaborators([]);
    } catch (error) {
      handleAlert(`Failed to toggle mode: ${error}`, 'error');
    }
  };

  const handleInvite = async (email: string, role: string) => {
    try {
      await axios.post(`${COLLAB_URL}/${fileId}`, { email, role }, { headers: { Authorization: `${session?.user?.token}` } });
      handleAlert('Invite sent successfully!', 'success');
      await fetchCollaborators();
      return true;
    } catch (error) {
      handleAlert(axios.isAxiosError(error) ? error.response?.data?.error : 'Error sending invite.', 'error');
      return false;
    }
  };

  const handleUpdateRole = async (collabId: string, email: string, newRole: string) => {
    try {
      await axios.patch(`${COLLAB_URL}/${fileId}`, { email, role: newRole }, { params: { collabId }, headers: { Authorization: `${session?.user?.token}` } });
      setCollaborators(prev => prev.map(c => (c.id === collabId ? { ...c, role: newRole } : c)));
      handleAlert('Role updated successfully.', 'success');
    } catch (error) {
      handleAlert(axios.isAxiosError(error) ? error.response?.data?.error : 'Failed to update role.', 'error');
    }
  };
  
  const handleRemoveCollaborator = async (collabId: string, email: string) => {
    try {
      await axios.delete(`${COLLAB_URL}/${fileId}`, { data: { email }, headers: { Authorization: `${session?.user?.token}` }, params: { collabId } });
      setCollaborators(prev => prev.filter(c => c.id !== collabId));
      handleAlert('Collaborator removed.', 'success');
    } catch (error) {
      handleAlert(axios.isAxiosError(error) ? error.response?.data?.error : 'Failed to remove collaborator.', 'error');
    }
  };
  
  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    handleAlert('Link copied to clipboard!', 'success');
  };

  if (!isCollaborative && !isCurrentUserAdmin) {
    return <CanvasRestricted message="This canvas is private. Collaboration mode is turned off and you're not the admin." />;
  }

  // --- RENDER ---
  return (
    <div className="relative">
      <Popover.Root open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <Popover.Trigger asChild>
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-zinc-200 bg-zinc-800/80 hover:bg-zinc-700/80 transition-colors rounded-lg">
            <Users size={16} /> Share
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content sideOffset={8} align="end" className="z-[100] w-[24rem] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl text-white animate-in fade-in-0 zoom-in-95">
            <SharePopoverContent
              isCollaborative={isCollaborative}
              isCurrentUserAdmin={isCurrentUserAdmin}
              collaborators={collaborators}
              onInvite={handleInvite}
              onToggle={handleCollaborativeToggle}
              onCopyLink={copyShareLink}
              onUpdateRole={handleUpdateRole}
              onRemove={handleRemoveCollaborator}
              sessionUserEmail={session?.user?.email}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {showAlert && <AlertModal message={alertMessage} type={alertType} onClose={() => setShowAlert(false)} />}
    </div>
  );
};

// --- SUB-COMPONENTS ---

const SharePopoverContent = ({ isCollaborative, isCurrentUserAdmin, collaborators, onInvite, onToggle, onCopyLink, onUpdateRole, onRemove, sessionUserEmail }: any) => (
  <Tabs.Root defaultValue="invite" className="flex flex-col">
    <div className="p-4 space-y-3">
      <h3 className="text-lg font-bold text-zinc-50">Share this canvas</h3>
      <div className="flex items-center gap-2 p-1 bg-zinc-800 rounded-lg">
        <input type="text" readOnly value={isCollaborative ? "Anyone with the link can view" : "Only invited members can access"} className="flex-1 bg-transparent px-2 text-xs text-zinc-400 outline-none" />
        <button onClick={onCopyLink} className="px-2.5 py-1 text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 rounded-md transition-colors">
          Copy Link
        </button>
      </div>
    </div>
    <Tabs.List className="flex border-b border-zinc-700 px-4">
      <Tabs.Trigger value="invite" className="px-3 py-2 text-sm font-medium text-zinc-400 hover:text-white data-[state=active]:text-white data-[state=active]:shadow-[inset_0_-1px_0_0,0_1px_0_0] data-[state=active]:shadow-current transition-colors">Invite</Tabs.Trigger>
      <Tabs.Trigger value="members" className="px-3 py-2 text-sm font-medium text-zinc-400 hover:text-white data-[state=active]:text-white data-[state=active]:shadow-[inset_0_-1px_0_0,0_1px_0_0] data-[state=active]:shadow-current transition-colors">Members</Tabs.Trigger>
    </Tabs.List>
    
    <div className="p-4 max-h-[40vh] overflow-y-auto">
      <Tabs.Content value="invite"><InviteTab onInvite={onInvite} isEnabled={isCollaborative && isCurrentUserAdmin} /></Tabs.Content>
      <Tabs.Content value="members"><MembersTab collaborators={collaborators} onUpdateRole={onUpdateRole} onRemove={onRemove} isCurrentUserAdmin={isCurrentUserAdmin} sessionUserEmail={sessionUserEmail} /></Tabs.Content>
    </div>

    {isCurrentUserAdmin && (
      <div className="flex items-center justify-between p-4 border-t border-zinc-700 bg-zinc-900/50">
        <div className="text-sm">
          <p className="font-semibold text-zinc-200">Live Collaboration</p>
          <p className="text-xs text-zinc-400">{isCollaborative ? 'Enabled' : 'Disabled'}</p>
        </div>
        <button onClick={onToggle} className={`relative h-6 w-11 rounded-full transition-colors ${isCollaborative ? 'bg-orange-500' : 'bg-zinc-700'}`}>
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 bg-white rounded-full transition-transform ${isCollaborative ? 'translate-x-5' : ''}`} />
        </button>
      </div>
    )}
  </Tabs.Root>
);

const InviteTab = ({ onInvite, isEnabled }: { onInvite: (email: string, role: string) => Promise<boolean>, isEnabled: boolean }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('USER');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onInvite(email, role);
    if (success) {
      setEmail('');
      setRole('USER');
    }
  };

  if (!isEnabled) {
    return <div className="text-center text-sm text-zinc-400 py-8">Enable Live Collaboration to invite members.</div>;
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-zinc-400">Invite new members to collaborate on this canvas.</p>
      <div className="relative">
        <Mail size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500" />
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:ring-2 focus:ring-orange-500 focus:outline-none" />
      </div>
      <div className="flex items-center gap-2">
        <select value={role} onChange={e => setRole(e.target.value)} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:ring-2 focus:ring-orange-500 focus:outline-none">
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <button type="submit" className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors">Invite</button>
      </div>
    </form>
  );
};

const MembersTab = ({ collaborators, onUpdateRole, onRemove, isCurrentUserAdmin, sessionUserEmail }: any) => {
  if (collaborators.length === 0) {
    return <div className="text-center text-sm text-zinc-400 py-8">No members have been invited yet.</div>;
  }
  return (
    <div className="space-y-2">
      {collaborators.map((c: Collaborator) => (
        <CollaboratorItem key={c.id} collab={c} onUpdateRole={onUpdateRole} onRemove={onRemove} isCurrentUserAdmin={isCurrentUserAdmin} sessionUserEmail={sessionUserEmail} />
      ))}
    </div>
  );
};

const CollaboratorItem = ({ collab, onUpdateRole, onRemove, isCurrentUserAdmin, sessionUserEmail }: any) => (
  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800">
    <div className="flex items-center gap-3">
      <Image src={collab.user.profilePhoto} alt={collab.user.name} width={32} height={32} className="rounded-full object-cover" />
      <div>
        <p className="text-sm font-semibold text-zinc-200">{collab.user.name}</p>
        <p className="text-xs text-zinc-400">{collab.user.email}</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-300">{ROLES.find(r => r.value === collab.role)?.label}</span>
      {isCurrentUserAdmin && collab.user.email !== sessionUserEmail && (
        <Popover.Root>
          <Popover.Trigger asChild><button className="p-1.5 rounded-md hover:bg-zinc-700"><MoreHorizontal size={16} className="text-zinc-400" /></button></Popover.Trigger>
          <Popover.Portal>
            <Popover.Content sideOffset={5} className="z-[110] w-48 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg p-1">
              <p className="px-2 py-1.5 text-xs font-semibold text-zinc-400">Change Role</p>
              {ROLES.map(r => (
                <Popover.Close key={r.value} asChild>
                  <button onClick={() => onUpdateRole(collab.id, collab.user.email, r.value)} className="w-full text-left px-2 py-1.5 text-sm text-zinc-200 rounded hover:bg-zinc-700 flex items-center justify-between">
                    {r.label} {collab.role === r.value && <Check size={14} />}
                  </button>
                </Popover.Close>
              ))}
              <div className="h-px bg-zinc-700 my-1" />
              <Popover.Close asChild>
                <button onClick={() => onRemove(collab.id, collab.user.email)} className="w-full text-left px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded">Remove</button>
              </Popover.Close>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  </div>
);

export default ShareButton;