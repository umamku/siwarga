import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CreditCard, 
  CheckCircle, 
  Clock, 
  XCircle, 
  User, 
  LogOut, 
  Plus, 
  ShieldCheck, 
  Upload,
  Database, 
  RefreshCw, 
  Link as LinkIcon, 
  FileSpreadsheet, 
  AlertCircle, 
  Copy, 
  Lock, 
  X, 
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Search,
  KeyRound
} from 'lucide-react';

// --- SECURITY UTILS ---

async function hashString(message) {
  if (!message) return '';
  const msgString = String(message).trim(); // Trim whitespace
  const msgBuffer = new TextEncoder().encode(msgString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const SecurityGuard = ({ children }) => {
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    const handleKeyDown = (e) => {
      if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || 
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  return <div className="select-none" onCopy={(e) => e.preventDefault()}>{children}</div>;
};

// --- Constants & Mock Data ---

const BLOCK_LETTERS = ['A', 'B', 'C', 'D'];
const BLOCK_NUMBERS = ['1', '2', '3', '4', '5'];
const HOUSE_NUMBERS = Array.from({length: 22}, (_, i) => i + 1);
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Mock data awal
const MOCK_USERS_INIT = [
  { houseNumber: 'A1/1', name: 'Pak Budi', role: 'warga', pin: '1234' },
  { houseNumber: 'Admin', name: 'Bendahara RW', role: 'admin', pin: '1234' }
];

const MOCK_PAYMENTS = [
  { id: '1', houseNumber: 'A1/1', userName: 'Pak Budi', month: 'Januari', year: 2024, amount: 50000, status: 'confirmed', note: 'Lunas awal tahun', date: '2024-01-05', proofLink: '' },
  { id: '2', houseNumber: 'A1/1', userName: 'Pak Budi', month: 'Februari', year: 2024, amount: 50000, status: 'pending', note: 'Transfer via BCA', date: '2024-02-05', proofLink: '' }
];

// --- GAS SCRIPT ---
const GAS_SCRIPT_CODE = `/**
 * Backend SiWarga v3
 * Update: Menambahkan fitur Reset PIN
 */
const SHEET_USERS = 'Users';
const SHEET_PAYMENTS = 'Payments';
const DRIVE_FOLDER_NAME = 'SiWarga_Bukti_Transfer';

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'getUsers') {
    const sheet = ss.getSheetByName(SHEET_USERS) || createSheetUsers(ss);
    // Gunakan getDisplayValues untuk memastikan format string terjaga (misal '0123')
    const data = sheet.getDataRange().getDisplayValues(); 
    const users = data.slice(1).map(r => ({ 
      houseNumber: r[0], name: r[1], role: r[2], pin: r[3] 
    }));
    return jsonResponse({ status: 'success', data: users });
  }
  
  if (action === 'getPayments') {
    const sheet = ss.getSheetByName(SHEET_PAYMENTS) || createSheetPayments(ss);
    const data = sheet.getDataRange().getValues();
    const payments = data.slice(1).map(r => ({
      id: r[0], houseNumber: r[1], userName: r[2], month: r[3], year: r[4], 
      amount: r[5], status: r[6], note: r[7], proofLink: r[8], date: r[9]
    }));
    return jsonResponse({ status: 'success', data: payments });
  }
  return jsonResponse({ status: 'error', message: 'Unknown action' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'uploadProof') {
      const data = Utilities.base64Decode(body.base64Data);
      const blob = Utilities.newBlob(data, body.mimeType, body.fileName);
      let folder;
      const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
      if (folders.hasNext()) folder = folders.next();
      else folder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return jsonResponse({ status: 'success', url: "https://lh3.googleusercontent.com/d/" + file.getId() });
    }

    if (action === 'registerUser') {
      const sheet = ss.getSheetByName(SHEET_USERS) || createSheetUsers(ss);
      const existing = sheet.getDataRange().getValues();
      const isExist = existing.some(r => r[0] == body.houseNumber);
      if (!isExist) {
        // Paksa simpan sebagai string dengan tanda petik satu
        sheet.appendRow([body.houseNumber, body.name, body.role, "'" + body.pin]);
        return jsonResponse({ status: 'success', message: 'User registered' });
      }
      return jsonResponse({ status: 'error', message: 'Rumah sudah terdaftar' });
    }

    // --- Reset PIN Logic ---
    if (action === 'resetUserPin') {
      const sheet = ss.getSheetByName(SHEET_USERS);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == body.houseNumber) {
           sheet.getRange(i + 1, 4).setValue("'" + body.newPinHash); 
           return jsonResponse({ status: 'success', message: 'PIN reset berhasil' });
        }
      }
      return jsonResponse({ status: 'error', message: 'User tidak ditemukan' });
    }

    if (action === 'addPayment') {
      const sheet = ss.getSheetByName(SHEET_PAYMENTS) || createSheetPayments(ss);
      sheet.appendRow([body.id, body.houseNumber, body.userName, body.month, body.year, body.amount, body.status, body.note, body.proofLink, body.date]);
      return jsonResponse({ status: 'success', message: 'Payment added' });
    }
    
    if (action === 'updatePaymentStatus') {
       const sheet = ss.getSheetByName(SHEET_PAYMENTS);
       const data = sheet.getDataRange().getValues();
       for (let i = 1; i < data.length; i++) {
         if (data[i][0] == body.id) {
           sheet.getRange(i + 1, 7).setValue(body.status);
           return jsonResponse({ status: 'success', message: 'Status updated' });
         }
       }
       return jsonResponse({ status: 'error', message: 'ID not found' });
    }
    return jsonResponse({ status: 'error', message: 'Unknown POST action' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function createSheetUsers(ss) {
  const sheet = ss.insertSheet(SHEET_USERS);
  sheet.appendRow(['House Number', 'Name', 'Role', 'PIN']);
  sheet.setFrozenRows(1);
  return sheet;
}

function createSheetPayments(ss) {
  const sheet = ss.insertSheet(SHEET_PAYMENTS);
  sheet.appendRow(['ID', 'House Number', 'Name', 'Month', 'Year', 'Amount', 'Status', 'Note', 'Proof Link', 'Date']);
  sheet.setFrozenRows(1);
  return sheet;
}`;

// --- Utils ---

const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
const generateId = () => Math.random().toString(36).substr(2, 9);
const convertFileToBase64 = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result); reader.onerror = error => reject(error); });

const getEmbedUrl = (url) => {
  if (!url) return '';
  try {
    const cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http')) return '';
    if (cleanUrl.includes('drive.google.com') || cleanUrl.includes('googleusercontent.com')) {
      let id = '';
      const lh3Match = cleanUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (lh3Match) id = lh3Match[1];
      if (!id) { const fileMatch = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/); if (fileMatch) id = fileMatch[1]; }
      if (!id) { const idMatch = cleanUrl.match(/id=([a-zA-Z0-9_-]+)/); if (idMatch) id = idMatch[1]; }
      if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
    }
    return cleanUrl;
  } catch (e) { return ''; }
};

const copyToClipboard = (text) => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try { document.execCommand('copy'); return true; } catch (err) { return false; } finally { document.body.removeChild(textarea); }
};

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { if (message) { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); } }, [message, onClose]);
  if (!message) return null;
  return (
    <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 transition-all duration-300 animate-in slide-in-from-top-4 ${type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : type === 'warning' ? 'bg-orange-50 text-orange-800 border border-orange-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
      {type === 'error' ? <ShieldAlert className="w-5 h-5"/> : type === 'warning' ? <AlertTriangle className="w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>}
      <span className="font-medium text-sm">{message}</span>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  switch (status) {
    case 'confirmed': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Lunas</span>;
    case 'rejected': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Ditolak</span>;
    default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Menunggu</span>;
  }
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 animate-in fade-in duration-200 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col transform transition-all scale-100">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0 select-none">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600"/> {title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors bg-white p-1 rounded-full border border-transparent hover:border-gray-200"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

// --- Settings Component with User Management ---
const SettingsContent = (props) => {
  const { isSettingsUnlocked, inputSettingsPass, setInputSettingsPass, handleUnlockSettings, configTab, setConfigTab, dbConfig, setDbConfig, saveConfig, loading, handleRefresh, lastSynced, appConfig, setAppConfig, handleSaveAppConfig, newSettingsPass, setNewSettingsPass, confirmSettingsPass, setConfirmSettingsPass, handleChangeSettingsPassword, showUrl, setShowUrl, failedAttempts, isLockedOut, scriptCopied, handleCopyScript, users, handleResetPin } = props;
  const [searchTerm, setSearchTerm] = useState('');

  if (isLockedOut) return <div className="text-center p-8 bg-red-50 rounded-xl border border-red-100 animate-in fade-in"><ShieldAlert className="w-16 h-16 mx-auto text-red-600 mb-4 animate-pulse" /><h3 className="text-lg font-bold text-red-800 mb-2">Akses Terkunci Sementara</h3><p className="text-red-600 text-sm">Terlalu banyak percobaan salah. Silakan tunggu 30 detik.</p></div>;

  if (!isSettingsUnlocked) return (
    <form onSubmit={handleUnlockSettings} className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="text-center p-6 bg-gray-50 rounded-xl border border-gray-100"><div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm"><Lock className="w-8 h-8 text-emerald-600" /></div><p className="text-gray-600 text-sm font-medium">Sistem Keamanan Aktif. Masukkan password administrator.</p>{failedAttempts > 0 && <p className="text-xs text-red-500 mt-2 font-bold">Percobaan salah: {failedAttempts}/3</p>}</div>
      <input type="password" value={inputSettingsPass} onChange={e=>setInputSettingsPass(e.target.value)} className="block w-full p-3 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Password Pengaturan" autoFocus />
      <button type="submit" className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-200">Buka Pengaturan</button>
    </form>
  );

  return (
    <div className="space-y-4">
      <div className="flex border-b border-gray-200 overflow-x-auto pb-1">
        {['connection', 'warga', 'data', 'tampilan', 'script', 'keamanan'].map((tab) => (
          <button key={tab} onClick={()=>setConfigTab(tab)} className={`flex-1 py-2 px-3 text-[10px] sm:text-xs font-medium capitalize whitespace-nowrap transition-colors ${configTab===tab ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}>{tab}</button>
        ))}
      </div>

      {configTab === 'connection' && (
        <form onSubmit={saveConfig} className="space-y-4 pt-2 animate-in fade-in">
          <div><label className="block text-sm font-medium text-gray-700 mb-2">Mode Database</label><div className="flex gap-2 p-1 bg-gray-100 rounded-lg"><button type="button" onClick={()=>setDbConfig({...dbConfig, mode: 'sheet'})} className={`flex-1 py-2 text-xs font-bold rounded-md ${dbConfig.mode === 'sheet' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500'}`}>Google Sheet</button><button type="button" onClick={()=>setDbConfig({...dbConfig, mode: 'local'})} className={`flex-1 py-2 text-xs font-bold rounded-md ${dbConfig.mode === 'local' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>Demo (Lokal)</button></div></div>
          {dbConfig.mode === 'sheet' && (<div><label className="block text-sm font-medium text-gray-700 mb-1">URL Web App Google Script</label><div className="relative"><input type={showUrl ? "text" : "password"} value={dbConfig.scriptUrl} onChange={e => setDbConfig({...dbConfig, scriptUrl: e.target.value})} className="mt-1 block w-full p-2.5 pr-10 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="https://script.google.com/..." /><button type="button" onClick={() => setShowUrl(!showUrl)} className="absolute right-2 top-3 text-gray-400 hover:text-gray-600">{showUrl ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}</button></div></div>)}
          <button type="submit" className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black">Simpan Koneksi</button>
        </form>
      )}

      {configTab === 'warga' && (
        <div className="space-y-4 pt-2 animate-in fade-in">
          <div className="relative"><input type="text" placeholder="Cari nama atau rumah..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-9 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"/><Search className="w-4 h-4 text-gray-400 absolute left-3 top-3"/></div>
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Rumah</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Nama</th><th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Aksi</th></tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.houseNumber.toLowerCase().includes(searchTerm.toLowerCase())).map((user, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 text-xs font-mono text-gray-600">{user.houseNumber}</td>
                    <td className="px-3 py-2 text-xs font-medium text-gray-900">{user.name}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => handleResetPin(user)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors text-[10px] font-bold border border-red-200 flex items-center gap-1 ml-auto"><RotateCcw className="w-3 h-3"/> Reset PIN</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-500 italic">*Reset PIN akan mengubah PIN warga menjadi <strong>123456</strong>.</p>
        </div>
      )}

      {configTab === 'data' && (
         <div className="space-y-6 pt-4 text-center animate-in fade-in">
            <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
              <h4 className="text-sm font-bold text-blue-800 mb-1">Sinkronisasi Data</h4>
              <p className="text-xs text-blue-600 mb-4">Tarik data aman dari server untuk memperbarui tampilan.</p>
              {dbConfig.mode === 'sheet' ? (
                <button onClick={handleRefresh} disabled={loading} className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shadow-sm"><RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Menyinkronkan...' : 'Sinkronisasi Aman'}</button>
              ) : ( <div className="text-xs text-orange-600 bg-orange-100 p-3 rounded-lg border border-orange-200 font-medium">Mode Lokal.</div> )}
            </div>
         </div>
      )}

      {configTab === 'tampilan' && (
        <form onSubmit={handleSaveAppConfig} className="space-y-4 pt-2 animate-in fade-in">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nama Aplikasi</label><input type="text" value={appConfig.appName} onChange={e => setAppConfig({...appConfig, appName: e.target.value})} className="mt-1 block w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nama Perumahan</label><input type="text" value={appConfig.housingName} onChange={e => setAppConfig({...appConfig, housingName: e.target.value})} className="mt-1 block w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">URL Logo</label><input type="text" value={appConfig.logoUrl} onChange={e => setAppConfig({...appConfig, logoUrl: e.target.value})} className="mt-1 block w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
          <button type="submit" className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Simpan Tampilan</button>
        </form>
      )}

      {configTab === 'script' && (
        <div className="space-y-3 pt-2 animate-in fade-in">
          <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-600 border border-slate-200">
            <p className="mb-2 font-medium text-slate-800">Cara Install Backend (UPDATE DENGAN KODE BARU INI):</p>
            <ol className="list-decimal ml-4 space-y-1">
              <li>Buka Google Sheet {'>'} Extensions {'>'} Apps Script</li>
              <li>Hapus kode lama, paste kode di bawah ini.</li>
              <li>Deploy ulang sebagai Web App (New Version).</li>
            </ol>
          </div>
          <div className="relative group"><textarea readOnly value={GAS_SCRIPT_CODE} className="w-full h-48 p-3 text-[10px] font-mono bg-slate-900 text-emerald-400 rounded-lg outline-none focus:ring-2 focus:ring-slate-500" /><button onClick={handleCopyScript} className={`absolute top-2 right-2 p-2 rounded-md shadow-sm transition-all ${scriptCopied ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-gray-700 hover:bg-gray-100'}`} title="Copy Code">{scriptCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button></div>
        </div>
      )}

      {configTab === 'keamanan' && (
        <form onSubmit={handleChangeSettingsPassword} className="space-y-4 pt-2 animate-in fade-in">
          <div className="bg-red-50 p-3 rounded-lg text-xs text-red-800 border border-red-200 flex items-start gap-2"><ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" /><p>Password terenkripsi (SHA-256).</p></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label><input type="password" value={newSettingsPass} onChange={e=>setNewSettingsPass(e.target.value)} className="mt-1 block w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Minimal 6 karakter" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password</label><input type="password" value={confirmSettingsPass} onChange={e=>setConfirmSettingsPass(e.target.value)} className="mt-1 block w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Ulangi password" /></div>
          <button type="submit" className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Update Keamanan</button>
        </form>
      )}
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [sessionUser, setSessionUser] = useState(null);
  const [dbConfig, setDbConfig] = useState({ mode: 'sheet', scriptUrl: '' });
  const [appConfig, setAppConfig] = useState({ appName: 'SiWarga Aman', housingName: 'Perumahan Muslim Mutiara Darussalam', logoUrl: '' });
  const [settingsPassHash, setSettingsPassHash] = useState('');
  const [isSettingsUnlocked, setIsSettingsUnlocked] = useState(false);
  const [inputSettingsPass, setInputSettingsPass] = useState('');
  const [configTab, setConfigTab] = useState('connection'); 
  const [lastSynced, setLastSynced] = useState(null);
  const [showUrl, setShowUrl] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [viewProofModal, setViewProofModal] = useState(null);
  const [authStep, setAuthStep] = useState('check_house');
  const [scriptCopied, setScriptCopied] = useState(false);
  
  // Login States
  const [loginRole, setLoginRole] = useState('warga');
  const [selBlockLetter, setSelBlockLetter] = useState('A');
  const [selBlockNum, setSelBlockNum] = useState('1');
  const [selHouseNum, setSelHouseNum] = useState('1');
  const [inputPin, setInputPin] = useState('');
  const [showPin, setShowPin] = useState(false); // NEW: Show PIN toggle
  const [inputName, setInputName] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [detectedUser, setDetectedUser] = useState(null);
  const [newSettingsPass, setNewSettingsPass] = useState('');
  const [confirmSettingsPass, setConfirmSettingsPass] = useState('');
  
  // Payment States
  const [payMonth, setPayMonth] = useState(MONTHS[new Date().getMonth()]);
  const [payYear, setPayYear] = useState(new Date().getFullYear());
  const [payAmount, setPayAmount] = useState(200000);
  const [payNote, setPayNote] = useState('');
  const [payFile, setPayFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const currentHouseId = useMemo(() => `${selBlockLetter}${selBlockNum}/${selHouseNum}`, [selBlockLetter, selBlockNum, selHouseNum]);

  const showToast = (message, type = 'info') => setToast({ message, type });

  // Init Data
  useEffect(() => {
    const initializeSecurity = async () => {
      const savedConfig = localStorage.getItem('siwarga_db_config');
      if (savedConfig) setDbConfig(JSON.parse(savedConfig));

      const savedAppConfig = localStorage.getItem('siwarga_app_config');
      if (savedAppConfig) setAppConfig(JSON.parse(savedAppConfig));
      
      let loadedUsers = MOCK_USERS_INIT;
      const savedUsers = localStorage.getItem('siwarga_users');
      if (savedUsers) loadedUsers = JSON.parse(savedUsers);

      const secureUsers = await Promise.all(loadedUsers.map(async (u) => {
        if (u.pin.length < 20) return { ...u, pin: await hashString(u.pin) };
        return u;
      }));
      setUsers(secureUsers);

      const savedPayments = localStorage.getItem('siwarga_payments');
      if (savedPayments) setPayments(JSON.parse(savedPayments));
      else setPayments(MOCK_PAYMENTS);

      let currentHash = localStorage.getItem('siwarga_settings_pass_hash');
      if (!currentHash) {
        currentHash = await hashString('KodeRahasia123!'); 
        localStorage.setItem('siwarga_settings_pass_hash', currentHash);
      }
      setSettingsPassHash(currentHash);
    };
    initializeSecurity();
  }, []);

  useEffect(() => { if (dbConfig.mode === 'sheet' && dbConfig.scriptUrl) fetchDataFromSheet(); }, [dbConfig]);
  useEffect(() => { if (isLockedOut) { const timer = setTimeout(() => { setIsLockedOut(false); setFailedAttempts(0); }, 30000); return () => clearTimeout(timer); } }, [isLockedOut]);

  // --- FIXED: Fetch & Migrate Logic ---
  const fetchDataFromSheet = async () => {
    if (!dbConfig.scriptUrl || !dbConfig.scriptUrl.startsWith('http')) return; 
    setLoading(true); setUploadProgress('Enkripsi data...');
    try {
      const resUsers = await fetch(`${dbConfig.scriptUrl}?action=getUsers`);
      const dataUsers = await resUsers.json();
      if (dataUsers.status === 'success') {
          // Proses data users dari sheet:
          // Jika PIN panjang (<20 char) kemungkinan itu Plain Text (Data Lama), jadi kita Hash dulu di sisi App
          // Jika PIN panjang (64 char), itu sudah hash dari DB baru.
          const processedUsers = await Promise.all(dataUsers.data.map(async (u) => {
            // Kita paksa konversi ke string dulu untuk cek length
            const pinStr = String(u.pin);
            if (pinStr.length < 20) {
               // Ini data lama (Plain Text), misal "10147" atau "010147"
               return { ...u, pin: await hashString(pinStr) };
            }
            // Ini data baru (sudah hash)
            return u;
          }));
          setUsers(processedUsers);
      }

      const resPayments = await fetch(`${dbConfig.scriptUrl}?action=getPayments`);
      const dataPayments = await resPayments.json();
      if (dataPayments.status === 'success') {
        const sorted = dataPayments.data.sort((a,b) => new Date(b.date) - new Date(a.date));
        setPayments(sorted);
        setLastSynced(new Date());
      }
    } catch (error) { console.error("Sheet Error:", error); showToast("Gagal sinkronisasi data aman", "error"); } finally { setLoading(false); setUploadProgress(''); }
  };

  const saveDataToSheet = async (action, payload) => {
    if (!dbConfig.scriptUrl || !dbConfig.scriptUrl.startsWith('http')) throw new Error("URL Script belum diatur");
    try {
      const response = await fetch(dbConfig.scriptUrl, { method: 'POST', body: JSON.stringify({ action, ...payload }) });
      return await response.json();
    } catch (error) { console.error("Save Error:", error); throw error; }
  };

  const handleOpenSettings = () => { setIsConfigOpen(true); setIsSettingsUnlocked(false); setInputSettingsPass(''); setConfigTab('connection'); setShowUrl(false); setFailedAttempts(0); };

  const handleUnlockSettings = async (e) => {
    e.preventDefault();
    if (isLockedOut) return;
    const hash = await hashString(inputSettingsPass);
    if (hash === settingsPassHash) { setIsSettingsUnlocked(true); setInputSettingsPass(''); setFailedAttempts(0); showToast("Akses diberikan", "success"); } 
    else {
      const newAttempts = failedAttempts + 1; setFailedAttempts(newAttempts);
      if (newAttempts >= 3) { setIsLockedOut(true); showToast("Terkunci 30 detik.", "error"); } else { showToast(`Salah! Sisa: ${3 - newAttempts}`, "warning"); }
    }
  };

  const handleChangeSettingsPassword = async (e) => {
    e.preventDefault();
    if (newSettingsPass.length < 6) return showToast("Min 6 karakter", "error");
    if (newSettingsPass !== confirmSettingsPass) return showToast("Tidak cocok", "error");
    const hash = await hashString(newSettingsPass);
    setSettingsPassHash(hash);
    localStorage.setItem('siwarga_settings_pass_hash', hash);
    showToast("Password diamankan!", "success");
    setNewSettingsPass(''); setConfirmSettingsPass(''); setIsConfigOpen(false);
  };

  const handleSaveAppConfig = (e) => { e.preventDefault(); localStorage.setItem('siwarga_app_config', JSON.stringify(appConfig)); showToast("Tampilan disimpan!"); setIsConfigOpen(false); };

  const handleRefresh = () => {
    if (dbConfig.mode === 'sheet') {
      if (dbConfig.scriptUrl && dbConfig.scriptUrl.startsWith('http')) fetchDataFromSheet();
      else { showToast("URL Invalid", "error"); handleOpenSettings(); }
    } else { setLoading(true); setTimeout(() => { setLoading(false); showToast("Refresh lokal berhasil"); }, 500); }
  };

  const saveConfig = (e) => {
    e.preventDefault();
    localStorage.setItem('siwarga_db_config', JSON.stringify(dbConfig));
    showToast("Konfigurasi tersimpan");
    setIsConfigOpen(false);
    if (dbConfig.mode === 'sheet' && dbConfig.scriptUrl) fetchDataFromSheet();
  };

  const handleCopyScript = () => {
    if (copyToClipboard(GAS_SCRIPT_CODE)) { setScriptCopied(true); setTimeout(() => setScriptCopied(false), 2000); } 
    else showToast("Gagal copy", "error");
  };

  const handleResetPin = async (userToReset) => {
    if (!confirm(`Reset PIN untuk ${userToReset.name} (${userToReset.houseNumber}) menjadi 123456?`)) return;
    
    setLoading(true);
    try {
      const defaultPinHash = await hashString('123456');
      
      if (dbConfig.mode === 'sheet') {
        const result = await saveDataToSheet('resetUserPin', { 
          houseNumber: userToReset.houseNumber, 
          newPinHash: defaultPinHash 
        });
        if (result.status === 'success') {
          showToast(`PIN ${userToReset.name} berhasil direset!`, "success");
          await fetchDataFromSheet();
        } else {
          showToast("Gagal mereset di database: " + result.message, "error");
        }
      } else {
        // Local Mode Reset
        const updatedUsers = users.map(u => 
          u.houseNumber === userToReset.houseNumber ? { ...u, pin: defaultPinHash } : u
        );
        setUsers(updatedUsers);
        localStorage.setItem('siwarga_users', JSON.stringify(updatedUsers));
        showToast("PIN berhasil direset (Lokal)!", "success");
      }
    } catch (e) {
      showToast("Terjadi kesalahan sistem", "error");
    } finally {
      setLoading(false);
    }
  };

  const checkHouse = () => {
    if (loginRole === 'admin') {
      const adminUser = users.find(u => u.role === 'admin') || { name: 'Bendahara RW', role: 'admin', houseNumber: 'Admin', pin: '' }; 
      setDetectedUser(adminUser); setAuthStep('login'); setShowPin(false); return;
    }
    const found = users.find(u => u.houseNumber === currentHouseId);
    if (found) { setDetectedUser(found); setAuthStep('login'); setShowPin(false); } else { setDetectedUser(null); setAuthStep('register'); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (inputPin !== confirmPin) return showToast("PIN tidak cocok", "error");
    if (inputPin.length < 4) return showToast("Min 4 angka", "error");
    const pinHash = await hashString(inputPin);
    const newUser = { houseNumber: currentHouseId, name: inputName, role: 'warga', pin: pinHash };
    setLoading(true);
    try {
      if (dbConfig.mode === 'sheet') { await saveDataToSheet('registerUser', newUser); await fetchDataFromSheet(); } 
      else { const newUsers = [...users, newUser]; setUsers(newUsers); localStorage.setItem('siwarga_users', JSON.stringify(newUsers)); }
      setSessionUser(newUser); showToast("Pendaftaran Berhasil!", "success");
    } catch (e) { showToast("Gagal mendaftar.", "error"); } finally { setLoading(false); }
  };

  // --- FIXED: Robust Login Logic ---
  const handleLogin = async (e) => {
    e.preventDefault();
    if (detectedUser) {
      const inputTrimmed = inputPin.trim(); 
      
      // 1. Hash input apa adanya (misal "010147")
      const inputHash = await hashString(inputTrimmed);
      
      // 2. Hash input versi Number (misal "10147") - Antisipasi Google Sheet memotong nol
      let inputHashNoZero = '';
      if (!isNaN(inputTrimmed)) {
         inputHashNoZero = await hashString(Number(inputTrimmed).toString());
      }

      // 3. Hash khusus untuk admin default "1234"
      const defaultAdminHash = await hashString("1234");

      // Cek kecocokan
      const storedPin = String(detectedUser.pin).trim(); 
      
      const isMatch = 
        storedPin === inputHash ||        // Cocok dengan hash normal
        storedPin === inputHashNoZero ||  // Cocok dengan hash tanpa nol
        storedPin === inputTrimmed ||     // Cocok dengan Plain Text (Legacy Data)
        // Fallback Khusus: Cek jika data legacy "10147" vs input "010147" secara angka
        (!isNaN(inputTrimmed) && !isNaN(storedPin) && Number(storedPin) === Number(inputTrimmed)) ||
        (storedPin === '' && inputTrimmed === '1234') || // Admin baru
        (detectedUser.role === 'admin' && storedPin === defaultAdminHash && inputTrimmed === '1234');

      if (isMatch) {
        setSessionUser(detectedUser);
        showToast(`Selamat datang, ${detectedUser.name}`);
      } else {
        showToast("PIN Salah!", "error");
      }
    } else {
      showToast("User tidak ditemukan.", "error");
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return showToast("Max 5MB", "error");
      setPayFile(file); setPreviewUrl(await convertFileToBase64(file));
    }
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault(); setLoading(true); setUploadProgress('Upload...');
    try {
      let finalProofLink = '';
      if (dbConfig.mode === 'sheet') {
        if (payFile && previewUrl) {
          const base64Data = previewUrl.split(',')[1]; 
          const uploadRes = await saveDataToSheet('uploadProof', { base64Data, mimeType: payFile.type, fileName: `secure-${sessionUser.houseNumber}-${Date.now()}` });
          if (uploadRes.status === 'success') finalProofLink = uploadRes.url; else throw new Error('Gagal upload');
        }
        await saveDataToSheet('addPayment', { id: generateId(), houseNumber: sessionUser.houseNumber, userName: sessionUser.name, month: payMonth, year: payYear, amount: payAmount, note: payNote, status: 'pending', proofLink: finalProofLink, date: new Date().toISOString() });
        await fetchDataFromSheet();
      } else {
        const newPayment = { id: generateId(), houseNumber: sessionUser.houseNumber, userName: sessionUser.name, month: payMonth, year: payYear, amount: payAmount, note: payNote, status: 'pending', proofLink: previewUrl || finalProofLink, date: new Date().toISOString() };
        const updated = [newPayment, ...payments]; setPayments(updated); localStorage.setItem('siwarga_payments', JSON.stringify(updated));
      }
      setIsModalOpen(false); setPayFile(null); setPreviewUrl(null); setPayNote(''); showToast("Terkirim!", "success");
    } catch (e) { showToast("Gagal: " + e.message, "error"); } finally { setLoading(false); setUploadProgress(''); }
  };

  const handleVerify = async (paymentId, status) => {
    setLoading(true);
    try {
      if (dbConfig.mode === 'sheet') { await saveDataToSheet('updatePaymentStatus', { id: paymentId, status }); await fetchDataFromSheet(); } 
      else { const updated = payments.map(p => p.id === paymentId ? { ...p, status } : p); setPayments(updated); localStorage.setItem('siwarga_payments', JSON.stringify(updated)); }
      showToast("Status diupdate", "success");
    } catch (e) { showToast("Gagal update.", "error"); } finally { setLoading(false); }
  };

  const myPayments = useMemo(() => {
    if (!sessionUser) return [];
    if (sessionUser.role === 'admin') return payments;
    return payments.filter(p => p.houseNumber === sessionUser.houseNumber);
  }, [payments, sessionUser]);

  const pendingCount = payments.filter(p => p.status === 'pending').length;
  const totalMoney = payments.filter(p => p.status === 'confirmed').reduce((a, b) => a + parseInt(b.amount||0), 0);

  return (
    <SecurityGuard>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-emerald-200 selection:text-emerald-900">
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: '' })} />

        {!sessionUser ? (
          <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
            <button onClick={handleOpenSettings} className={`fixed top-4 right-4 p-3 rounded-full shadow-lg transition-all hover:scale-105 z-40 ${!dbConfig.scriptUrl ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-white text-gray-500 hover:text-emerald-600'}`} title="Pengaturan"><Database className="w-5 h-5" /></button>

            <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
              <div className="flex justify-center mb-8">
                <div className="h-24 w-24 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-3xl flex items-center justify-center shadow-2xl transform rotate-3 overflow-hidden ring-4 ring-white relative">
                   <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                  {appConfig.logoUrl ? <img src={appConfig.logoUrl} alt="Logo" className="w-full h-full object-cover z-10" /> : <ShieldCheck className="text-white w-12 h-12 z-10" />}
                </div>
              </div>
              <h2 className="text-center text-3xl font-extrabold text-slate-900 tracking-tight mb-2">{appConfig.appName}</h2>
              <p className="text-center text-sm font-medium text-emerald-700 max-w-xs mx-auto flex items-center justify-center gap-1"><Lock className="w-3 h-3"/> {appConfig.housingName}</p>
              
              <div className="mt-6 flex justify-center">
                {dbConfig.mode === 'sheet' ? (
                   dbConfig.scriptUrl && dbConfig.scriptUrl.startsWith('http') ? ( <span className="text-xs bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full flex items-center font-medium shadow-sm border border-emerald-200"><LinkIcon className="w-3 h-3 mr-1.5"/> Terhubung Aman</span> ) : ( <button onClick={handleOpenSettings} className="text-xs bg-red-100 text-red-700 px-4 py-1.5 rounded-full flex items-center font-medium shadow-sm hover:bg-red-200 animate-bounce border border-red-200"><AlertCircle className="w-3 h-3 mr-1.5"/> Setup Database</button> )
                ) : ( <span className="text-xs bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full flex items-center font-medium shadow-sm border border-orange-200"><Database className="w-3 h-3 mr-1.5"/> Mode Lokal</span> )}
              </div>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
              <div className="bg-white py-8 px-6 shadow-xl sm:rounded-2xl border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 to-teal-600"></div>
                {authStep === 'check_house' && (
                  <div className="space-y-6">
                    <div className="bg-slate-100 p-1 rounded-xl flex mb-6">
                      <button onClick={() => setLoginRole('warga')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${loginRole === 'warga' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}>Warga</button>
                      <button onClick={() => setLoginRole('admin')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${loginRole === 'admin' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Bendahara</button>
                    </div>
                    {loginRole === 'warga' ? (
                      <div className="animate-in fade-in slide-in-from-left-4">
                        <label className="block text-sm font-medium text-gray-700 mb-3">Pilih Unit Rumah</label>
                        <div className="flex gap-2 items-center">
                           <div className="relative flex-1"><select value={selBlockLetter} onChange={e=>setSelBlockLetter(e.target.value)} className="w-full appearance-none p-3 bg-gray-50 border border-gray-200 rounded-lg text-center font-semibold focus:ring-2 focus:ring-emerald-500 outline-none">{BLOCK_LETTERS.map(l=><option key={l} value={l}>{l}</option>)}</select><ChevronDown className="absolute right-2 top-3.5 w-4 h-4 text-gray-400 pointer-events-none"/></div>
                           <div className="relative flex-1"><select value={selBlockNum} onChange={e=>setSelBlockNum(e.target.value)} className="w-full appearance-none p-3 bg-gray-50 border border-gray-200 rounded-lg text-center font-semibold focus:ring-2 focus:ring-emerald-500 outline-none">{BLOCK_NUMBERS.map(n=><option key={n} value={n}>{n}</option>)}</select><ChevronDown className="absolute right-2 top-3.5 w-4 h-4 text-gray-400 pointer-events-none"/></div>
                          <span className="text-gray-300 font-light text-2xl">/</span>
                          <div className="relative flex-1"><select value={selHouseNum} onChange={e=>setSelHouseNum(e.target.value)} className="w-full appearance-none p-3 bg-gray-50 border border-gray-200 rounded-lg text-center font-semibold focus:ring-2 focus:ring-emerald-500 outline-none">{HOUSE_NUMBERS.map(n=><option key={n} value={n}>{n}</option>)}</select><ChevronDown className="absolute right-2 top-3.5 w-4 h-4 text-gray-400 pointer-events-none"/></div>
                        </div>
                        <div className="mt-6 p-4 bg-emerald-50 text-emerald-800 rounded-xl text-center font-mono font-bold border border-emerald-100 shadow-inner tracking-widest text-lg">{currentHouseId}</div>
                      </div>
                    ) : (
                      <div className="p-6 bg-blue-50 text-blue-800 rounded-xl text-sm text-center border border-blue-100 animate-in fade-in slide-in-from-right-4"><ShieldCheck className="w-12 h-12 mx-auto mb-2 text-blue-500 opacity-50"/>Login khusus pengurus.</div>
                    )}
                    <button onClick={checkHouse} className="w-full py-3 bg-gray-900 text-white rounded-xl hover:bg-black font-medium shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 group">Lanjut <span className="group-hover:translate-x-1 transition-transform">→</span></button>
                  </div>
                )}
                {authStep === 'login' && (
                  <form onSubmit={handleLogin} className="space-y-6 animate-in fade-in slide-in-from-right-8">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4"><User className="w-8 h-8 text-emerald-600" /></div>
                      <h3 className="font-bold text-xl text-gray-900">{detectedUser.name}</h3>
                      <p className="text-sm text-gray-500 font-mono">{detectedUser.houseNumber}</p>
                    </div>
                    <div>
                      <div className="relative">
                        <input type={showPin ? "text" : "password"} value={inputPin} onChange={e=>setInputPin(e.target.value)} className="block w-full py-3 px-4 border border-gray-300 rounded-xl text-center text-2xl tracking-[0.5em] focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow" maxLength={6} placeholder="******" autoFocus />
                        <button type="button" onClick={() => setShowPin(!showPin)} className="absolute right-3 top-4 text-gray-400 hover:text-gray-600">{showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                      </div>
                      <p className="text-xs text-center text-gray-400 mt-2">Masukkan PIN</p>
                    </div>
                    <div className="flex gap-3"><button type="button" onClick={()=>{setAuthStep('check_house'); setInputPin('')}} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium transition-colors">Kembali</button><button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium shadow-lg shadow-emerald-200 transition-all">Masuk</button></div>
                  </form>
                )}
                {authStep === 'register' && (
                  <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in slide-in-from-right-8">
                    <div className="text-center bg-orange-50 p-4 rounded-xl border border-orange-100 mb-6"><p className="text-xs text-orange-800 font-bold uppercase tracking-wide mb-1">Pendaftaran Baru</p><p className="text-2xl font-bold text-gray-900 font-mono">{currentHouseId}</p></div>
                    <div className="space-y-3">
                      <input required type="text" value={inputName} onChange={e=>setInputName(e.target.value)} className="block w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Nama Lengkap" />
                      <div className="grid grid-cols-2 gap-3">
                        <input required type="password" value={inputPin} onChange={e=>setInputPin(e.target.value)} className="block w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-center" maxLength={6} placeholder="PIN Baru" />
                        <input required type="password" value={confirmPin} onChange={e=>setConfirmPin(e.target.value)} className="block w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-center" maxLength={6} placeholder="Ulangi PIN" />
                      </div>
                      <p className="text-[10px] text-gray-400 text-center">PIN Anda akan dienkripsi secara aman.</p>
                    </div>
                    <div className="flex gap-3 pt-2"><button type="button" onClick={()=>{setAuthStep('check_house'); setInputPin('')}} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium">Batal</button><button type="submit" disabled={loading} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium shadow-lg shadow-emerald-200 disabled:opacity-70 flex items-center justify-center">{loading ? <RefreshCw className="w-5 h-5 animate-spin"/> : 'Daftar & Enkripsi'}</button></div>
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm border-b sticky top-0 z-30">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-lg flex items-center justify-center shadow-md text-white overflow-hidden relative"><div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>{appConfig.logoUrl ? <img src={appConfig.logoUrl} alt="Logo" className="w-full h-full object-cover z-10" /> : <ShieldCheck className="w-6 h-6 z-10" />}</div>
                    <div className="hidden sm:block"><h1 className="text-lg font-bold text-gray-900 leading-tight">{appConfig.appName}</h1><p className="text-[10px] text-gray-500 font-medium">{appConfig.housingName}</p></div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4">
                    {sessionUser.role === 'admin' && (<div className="hidden md:flex items-center gap-3 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100"><p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Kas</p><p className="text-base font-bold text-emerald-800">{formatCurrency(totalMoney)}</p></div>)}
                    <div className="flex items-center gap-3 pl-2 sm:pl-0">
                       <div className="text-right hidden sm:block"><p className="text-sm font-bold text-gray-900">{sessionUser.name}</p><p className="text-xs text-gray-500 font-mono">{sessionUser.houseNumber}</p></div>
                       <div className="h-9 w-9 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 text-gray-600"><User className="w-5 h-5"/></div>
                    </div>
                    <div className="h-8 w-px bg-gray-200 mx-1"></div>
                    <button onClick={handleOpenSettings} className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Pengaturan"><Database className="w-5 h-5" /></button>
                    <button onClick={() => { setSessionUser(null); setAuthStep('check_house'); setInputPin(''); }} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Keluar"><LogOut className="w-5 h-5" /></button>
                  </div>
                </div>
              </div>
            </header>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {sessionUser.role === 'admin' && (
                 <div className="md:hidden bg-white p-4 rounded-xl shadow-sm border border-emerald-100 mb-6 flex justify-between items-center"><div><p className="text-xs text-gray-500 uppercase tracking-wide">Total Dana</p><p className="text-xl font-bold text-emerald-700">{formatCurrency(totalMoney)}</p></div><div className="bg-emerald-100 p-2 rounded-lg"><CreditCard className="w-6 h-6 text-emerald-600"/></div></div>
              )}
              {sessionUser.role === 'admin' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-shadow hover:shadow-md"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-500">Menunggu Verifikasi</p><p className="text-3xl font-bold text-gray-900 mt-1">{pendingCount}</p></div><div className="p-3 bg-yellow-50 rounded-xl"><Clock className="w-8 h-8 text-yellow-600" /></div></div></div>
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-shadow hover:shadow-md"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-500">Total Transaksi</p><p className="text-3xl font-bold text-gray-900 mt-1">{payments.length}</p></div><div className="p-3 bg-blue-50 rounded-xl"><CreditCard className="w-8 h-8 text-blue-600" /></div></div></div>
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-shadow hover:shadow-md"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-500">Warga Terdaftar</p><p className="text-3xl font-bold text-gray-900 mt-1">{users.length}</p></div><div className="p-3 bg-indigo-50 rounded-xl"><User className="w-8 h-8 text-indigo-600" /></div></div></div>
                </div>
              )}
              {sessionUser.role === 'warga' && (
                <div className="mb-8 flex justify-between items-center"><div><h2 className="text-2xl font-bold text-gray-900">Halo, {sessionUser.name.split(' ')[0]}!</h2><p className="text-gray-500 text-sm">Berikut adalah riwayat pembayaran iuran Anda.</p></div><button onClick={() => setIsModalOpen(true)} className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-black font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2 transform hover:-translate-y-0.5"><Plus className="w-5 h-5" /><span className="hidden sm:inline">Bayar Iuran</span><span className="sm:hidden">Bayar</span></button></div>
              )}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50"><h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">{sessionUser.role === 'admin' ? <Database className="w-5 h-5 text-gray-500"/> : <CreditCard className="w-5 h-5 text-gray-500"/>}{sessionUser.role === 'admin' ? 'Semua Transaksi Masuk' : 'Riwayat Pembayaran'}</h2><button onClick={handleRefresh} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Refresh Data"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button></div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</th><th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Warga</th><th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Periode</th><th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Jumlah</th><th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>{sessionUser.role === 'admin' && (<th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>)}</tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {myPayments.length === 0 ? (
                        <tr><td colSpan={sessionUser.role === 'admin' ? 6 : 5} className="px-6 py-12 text-center text-gray-500"><div className="flex flex-col items-center justify-center"><div className="bg-gray-50 rounded-full p-4 mb-3"><FileSpreadsheet className="w-8 h-8 text-gray-300"/></div><p>Belum ada data transaksi.</p></div></td></tr>
                      ) : (
                        myPayments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(payment.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</td>
                            <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs mr-3">{payment.userName.charAt(0)}</div><div><p className="text-sm font-medium text-gray-900">{payment.userName}</p><p className="text-xs text-gray-500 font-mono">{payment.houseNumber}</p></div></div></td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-medium">{payment.month} {payment.year}</span></td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 font-mono">{formatCurrency(payment.amount)}</td>
                            <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={payment.status} /></td>
                            {sessionUser.role === 'admin' && (
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                  {payment.status === 'pending' ? ( <><button onClick={() => handleVerify(payment.id, 'confirmed')} className="p-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 border border-green-200 transition-colors" title="Setujui"><Check className="w-4 h-4"/></button><button onClick={() => handleVerify(payment.id, 'rejected')} className="p-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 border border-red-200 transition-colors" title="Tolak"><X className="w-4 h-4"/></button></> ) : ( <span className="text-xs text-gray-400 italic py-1.5">Selesai</span> )}
                                  {payment.proofLink && ( <button onClick={() => setViewProofModal(payment)} className="p-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors" title="Lihat Bukti"><LinkIcon className="w-4 h-4"/></button> )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </main>
          </div>
        )}

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Ajukan Pembayaran Baru">
          <form onSubmit={handleSubmitPayment} className="space-y-5">
            <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Bulan</label><div className="relative"><select value={payMonth} onChange={(e) => setPayMonth(e.target.value)} className="w-full appearance-none p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white">{MONTHS.map((month) => <option key={month} value={month}>{month}</option>)}</select><ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-400 pointer-events-none"/></div></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Tahun</label><input type="number" value={payYear} onChange={(e) => setPayYear(parseInt(e.target.value))} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm" min="2020" max="2030"/></div></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Iuran</label><div className="relative"><span className="absolute left-3 top-2.5 text-gray-500 font-medium text-sm">Rp</span><input type="number" value={payAmount} onChange={(e) => setPayAmount(parseInt(e.target.value))} className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-medium" min="1000"/></div></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Catatan <span className="text-gray-400 font-normal">(Opsional)</span></label><input type="text" value={payNote} onChange={(e) => setPayNote(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm" placeholder="Contoh: Transfer via BCA a.n Budi"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Upload Bukti Transfer</label><div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-xl transition-all ${previewUrl ? 'border-emerald-300 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'}`}><div className="space-y-1 text-center">{previewUrl ? ( <div className="relative"><img src={previewUrl} alt="Preview" className="h-32 object-contain mx-auto rounded-lg shadow-sm border border-emerald-200" /><button type="button" onClick={()=>{setPayFile(null); setPreviewUrl(null)}} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"><X className="w-4 h-4"/></button><p className="text-xs text-emerald-600 mt-2 font-medium">Siap diupload</p></div> ) : ( <><Upload className="mx-auto h-12 w-12 text-gray-400" /><div className="flex text-sm text-gray-600 justify-center"><label className="relative cursor-pointer rounded-md font-medium text-emerald-600 hover:text-emerald-500 focus-within:outline-none"><span>Upload file</span><input type="file" className="sr-only" accept="image/*,.pdf" onChange={handleFileChange} /></label></div><p className="text-xs text-gray-500">PNG, JPG, PDF up to 5MB</p></> )}</div></div></div>
            {uploadProgress && ( <div className="text-sm flex items-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-100"><div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>{uploadProgress}</div> )}
            <div className="flex gap-3 pt-2"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors">Batal</button><button type="submit" disabled={loading} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium shadow-lg shadow-emerald-200 transition-all disabled:opacity-70 disabled:shadow-none">{loading ? 'Mengirim...' : 'Kirim Bukti'}</button></div>
          </form>
        </Modal>

        <Modal isOpen={!!viewProofModal} onClose={() => setViewProofModal(null)} title="Detail Bukti Transfer">
          {viewProofModal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100"><div><p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Warga</p><p className="font-semibold text-gray-900">{viewProofModal.userName}</p><p className="text-xs font-mono text-gray-500">{viewProofModal.houseNumber}</p></div><div className="text-right"><p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Jumlah</p><p className="font-bold text-emerald-700 text-lg">{formatCurrency(viewProofModal.amount)}</p></div><div className="col-span-2 border-t border-gray-200 pt-2 flex justify-between"><span>{viewProofModal.month} {viewProofModal.year}</span><span className="text-gray-500">{new Date(viewProofModal.date).toLocaleDateString()}</span></div></div>
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-slate-100 min-h-[200px] flex items-center justify-center relative group"><img src={getEmbedUrl(viewProofModal.proofLink)} alt="Bukti Transfer" className="w-full h-auto max-h-[400px] object-contain" onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/400x300?text=Gagal+Memuat+Gambar'; }} /><div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><a href={getEmbedUrl(viewProofModal.proofLink)} target="_blank" rel="noreferrer" className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors">Buka Gambar Asli</a></div></div>
            </div>
          )}
        </Modal>

        <Modal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} title="Pengaturan Aplikasi">
           <SettingsContent isSettingsUnlocked={isSettingsUnlocked} inputSettingsPass={inputSettingsPass} setInputSettingsPass={setInputSettingsPass} handleUnlockSettings={handleUnlockSettings} configTab={configTab} setConfigTab={setConfigTab} dbConfig={dbConfig} setDbConfig={setDbConfig} saveConfig={saveConfig} loading={loading} handleRefresh={handleRefresh} lastSynced={lastSynced} appConfig={appConfig} setAppConfig={setAppConfig} handleSaveAppConfig={handleSaveAppConfig} scriptCopied={scriptCopied} handleCopyScript={handleCopyScript} newSettingsPass={newSettingsPass} setNewSettingsPass={setNewSettingsPass} confirmSettingsPass={confirmSettingsPass} setConfirmSettingsPass={setConfirmSettingsPass} handleChangeSettingsPassword={handleChangeSettingsPassword} showUrl={showUrl} setShowUrl={setShowUrl} failedAttempts={failedAttempts} isLockedOut={isLockedOut} users={users} handleResetPin={handleResetPin} />
        </Modal>
      </div>
    </SecurityGuard>
  );
}