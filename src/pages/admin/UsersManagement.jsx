import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import useTitle from '../../hooks/useTitle';
import { authAPI } from '../../utils/api';
import { UserPlusIcon, PencilSquareIcon, TrashIcon, CheckIcon, XMarkIcon, DocumentDuplicateIcon, InformationCircleIcon, PlayIcon, VideoCameraIcon, DocumentTextIcon, ArrowPathIcon, MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/solid';
import {
  ClockIcon,
  XCircleIcon,
  ChevronDownIcon,
  SunIcon,
  CalendarIcon,
  CalendarDaysIcon,
  ShieldCheckIcon,
  UserIcon,
  PhoneIcon,
  ArrowsUpDownIcon
} from '@heroicons/react/24/outline';
import VideoPlayer from '../../components/VideoPlayer';
import { videosAPI } from '../../utils/api';

const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', subscriptionType: 'hour' });
  const [showForm, setShowForm] = useState(false);
  const [editUserId, setEditUserId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '' });
  const [createdCode, setCreatedCode] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [messageCopied, setMessageCopied] = useState(false);
  const [renewTarget, setRenewTarget] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState('views'); // 'views' | 'subscriptions'
  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // can hold user object
  // video player state for history playback
  const [playingVideo, setPlayingVideo] = useState(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  
  // States للبحث والفلترة
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest'
  const [subscriptionFilter, setSubscriptionFilter] = useState('all'); // 'all', 'active', 'expired', 'permanent'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'hour', 'day', 'week', 'month', 'permanent'

  useEffect(() => {
    loadUsers();
  }, []);

  useTitle('كورساتي — إدارة المستخدمين');

  useEffect(() => {
    applyFilters();
  }, [users, searchTerm, sortOrder, subscriptionFilter, typeFilter]);

  useEffect(() => {
    if (showModal && selectedUser) {
      loadUserHistory(selectedUser._id);
    }
  }, [showModal, selectedUser]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await authAPI.getAllUsers();
      setUsers(response.data || []);
    } catch (error) {
      // Error loading users (handled by UI)
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...users];
    
    // البحث
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(user => 
        (user.name && user.name.toLowerCase().includes(term)) ||
        (user.code && user.code.toLowerCase().includes(term)) ||
        (user.phone && user.phone.includes(term))
      );
    }
    
    // فلترة حسب حالة الاشتراك
    if (subscriptionFilter !== 'all') {
      const now = new Date();
      result = result.filter(user => {
        if (subscriptionFilter === 'active') {
          return user.subscriptionType !== 'permanent' && 
                 user.subscriptionExpires && 
                 new Date(user.subscriptionExpires) > now;
        } else if (subscriptionFilter === 'expired') {
          return user.subscriptionType !== 'permanent' && 
                 user.subscriptionExpires && 
                 new Date(user.subscriptionExpires) <= now;
        } else if (subscriptionFilter === 'permanent') {
          return user.subscriptionType === 'permanent';
        }
        return true;
      });
    }
    
    // فلترة حسب نوع الاشتراك
    if (typeFilter !== 'all') {
      result = result.filter(user => user.subscriptionType === typeFilter);
    }
    
    // الترتيب
    if (sortOrder === 'newest') {
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortOrder === 'oldest') {
      result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
    
    setFilteredUsers(result);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await authAPI.createUser(formData.name, formData.phone, formData.subscriptionType);
      const newUser = res.data?.user;
      setFormData({ name: '', phone: '', subscriptionType: 'hour' });
      setShowForm(false);
      await loadUsers();
      
      toast.success(`تم إنشاء المستخدم "${newUser.name}" بنجاح 🎉`, {
        position: 'top-right',
        autoClose: 3000,
      });
      
      if (newUser && newUser.code) {
        setCreatedCode(newUser.code);
        // build a full welcome message ready to send
        const subscriptionLabel = getSubscriptionLabel(newUser.subscriptionType);
        const subscriptionDuration = getSubscriptionDuration(newUser.subscriptionType);
        const expiryText = newUser.subscriptionType === 'permanent' ? 'دائم' : (newUser.subscriptionExpires ? new Date(newUser.subscriptionExpires).toLocaleString('ar-EG') : '—');
        const welcomeMsg = `مرحبًا ${newUser.name || ''}!\n\nتم إنشاء حسابك في كورساتي.\n\nكود الدخول: ${newUser.code}\nنوع الاشتراك: ${subscriptionLabel} (${subscriptionDuration})\nانتهاء الاشتراك: ${expiryText}\n\nتستطيع الآن الدخول باستخدام هذا الكود.`;

        // try to copy the full message; fallback to copying the code only
        try {
          await navigator.clipboard.writeText(welcomeMsg);
          setMessageCopied(true);
          setTimeout(() => setMessageCopied(false), 3000);
        } catch (err) {
          try {
            await navigator.clipboard.writeText(newUser.code);
            setCopiedId(newUser.code);
            setTimeout(() => setCopiedId(null), 2000);
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'فشل إنشاء المستخدم ❌', {
        position: 'top-right',
        autoClose: 3000,
      });
    }
  };
  
  // قائمة خيارات الاشتراك
  const subscriptionOptions = [
    {
      value: 'hour',
      label: 'ساعة',
      duration: '1 ساعة',
      icon: <ClockIcon className="w-5 h-5 text-blue-400" />
    },
    {
      value: 'day',
      label: 'يوم',
      duration: '24 ساعة',
      icon: <SunIcon className="w-5 h-5 text-yellow-400" />
    },
    {
      value: 'week',
      label: 'أسبوع',
      duration: '7 أيام',
      icon: <CalendarIcon className="w-5 h-5 text-orange-400" />
    },
    {
      value: 'month',
      label: 'شهر',
      duration: '30 يوم',
      icon: <CalendarDaysIcon className="w-5 h-5 text-purple-400" />
    },
    {
      value: 'permanent',
      label: 'دائم',
      duration: 'مدى الحياة',
      icon: <ShieldCheckIcon className="w-5 h-5 text-emerald-400" />
    }
  ];

  // دالة للحصول على تسمية الاشتراك
  const getSubscriptionLabel = (type) => {
    const option = subscriptionOptions.find(opt => opt.value === type);
    return option ? option.label : 'غير محدد';
  };

  // دالة للحصول على مدة الاشتراك
  const getSubscriptionDuration = (type) => {
    const option = subscriptionOptions.find(opt => opt.value === type);
    return option ? option.duration : 'غير محدد';
  };
  
  const copyCode = async (code) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(code);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      // fallback: create input
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
        setCopiedId(code);
        setTimeout(() => setCopiedId(null), 2000);
      } catch (e) {
        // Copy failed (removed console output)
      }
      document.body.removeChild(el);
    }
  };

  // copy arbitrary text with execCommand fallback
  const copyText = async (text) => {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(el);
        return true;
      } catch (e) {
        document.body.removeChild(el);
        // Copy failed (removed console output)
        return false;
      }
    }
  };

  const renewSubscription = async (userId, type) => {
    try {
      await authAPI.updateUserSubscription(userId, type);
      setRenewTarget(null);
      await loadUsers();
      // fetch updated user and update modal state so renew UI reacts to new expiry
      try {
        const userRes = await authAPI.getUserById(userId);
        if (userRes?.data?.user) {
          setSelectedUser(userRes.data.user);
        }
      } catch (e) {
        // ignore - users list already refreshed
      }
      toast.success(`تم تجديد الاشتراك ل ${getSubscriptionLabel(type)} بنجاح ✅`, {
        position: 'top-right',
        autoClose: 3000,
      });
      // refresh history if modal open for this user
      if (showModal && selectedUser && selectedUser._id === userId) {
        await loadUserHistory(userId);
      }
    } catch (err) {
      toast.error('فشل تجديد الاشتراك ❌', {
        position: 'top-right',
        autoClose: 3000,
      });
    }
  };

  const loadUserHistory = async (userId) => {
    if (!userId) return;
    setLoadingHistory(true);
    try {
      const res = await authAPI.getUserHistory(userId);
      setHistory(res.data || null);
    } catch (err) {
      // Failed to load user history (handled by UI)
      setHistory(null);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fmtRemaining = (user) => {
    if (!user) return '-';
    if (user.subscriptionType === 'permanent') return 'دائم';
    if (!user.subscriptionExpires) return '-';
    const now = new Date();
    const exp = new Date(user.subscriptionExpires);
    if (exp <= now) return 'منتهي';
    const diff = exp - now;
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (days >= 1) return `${days} يوم`;
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours >= 1) return `${hours} ساعة`;
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes} دقيقة`;
  };

  const handleEditClick = (user) => {
    setEditUserId(user._id);
    setEditForm({ name: user.name || '', phone: user.phone || '' });
  };

  const handleCancelEdit = () => {
    setEditUserId(null);
    setEditForm({ name: '', phone: '' });
  };

  const handleSaveEdit = async (id) => {
    try {
      const res = await authAPI.updateUser(id, editForm.name, editForm.phone);
      const updated = res.data?.user;
      setEditUserId(null);
      await loadUsers();
      toast.success(`تم تحديث بيانات "${editForm.name}" بنجاح ✅`, {
        position: 'top-right',
        autoClose: 3000,
      });
      if (selectedUser && selectedUser._id === id && updated) setSelectedUser(updated);
    } catch (error) {
      toast.error('حصل خطأ أثناء تحديث المستخدم ❌', {
        position: 'top-right',
        autoClose: 3000,
      });
    }
  };

  const handleDelete = async (id) => {
    try {
      await authAPI.deleteUser(id);
      await loadUsers();
      toast.success('تم حذف المستخدم بنجاح 🗑️', {
        position: 'top-right',
        autoClose: 3000,
      });
      // if modal was open for this user, close it
      if (showModal && selectedUser && selectedUser._id === id) {
        setShowModal(false);
        setSelectedUser(null);
        setHistory(null);
      }
    } catch (error) {
      toast.error('حصل خطأ أثناء حذف المستخدم ❌', {
        position: 'top-right',
        autoClose: 3000,
      });
    }
  };

  const openDeleteConfirm = (user) => {
    setDeleteTarget(user || null);
    setShowDeleteConfirm(true);
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
    setShowDeleteConfirm(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await handleDelete(deleteTarget._id);
    setDeleteTarget(null);
    setShowDeleteConfirm(false);
  };

  const resetDeviceForUser = async (userId) => {
    try {
      await authAPI.resetUserDevice(userId);
      toast.success('تم إعادة تعيين الجهاز للمستخدم بنجاح ✅', { position: 'top-right', autoClose: 2500 });
      await loadUsers();
      if (selectedUser && selectedUser._id === userId) {
        try {
          const res = await authAPI.getUserById(userId);
          if (res?.data) setSelectedUser(res.data);
        } catch (e) {}
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل إعادة التعيين ❌', { position: 'top-right', autoClose: 3000 });
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSortOrder('newest');
    setSubscriptionFilter('all');
    setTypeFilter('all');
  };

  return (
    <div className="space-y-6">
      {messageCopied && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg">
          تم نسخ رسالة الترحيب جاهزة للإرسال
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={cancelDelete} />
          <div className="relative w-full max-w-md bg-gray-800/95 border border-white/10 rounded-xl p-6 shadow-lg">
            <h4 className="text-lg font-semibold text-white mb-2">تأكيد الحذف</h4>
            <p className="text-sm text-white/70">هل أنت متأكد أنك تريد حذف المستخدم <span className="font-medium text-white">{deleteTarget.name || deleteTarget.code}</span>؟ لا يمكن التراجع عن هذا الإجراء.</p>

            <div className="mt-4 flex items-center justify-end gap-3">
              <button onClick={cancelDelete} className="px-4 py-2 bg-white/6 text-white rounded-lg hover:bg-white/10 transition-colors">إلغاء</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors">حذف</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white drop-shadow-sm tracking-tight">إدارة المستخدمين</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
        >
          <UserPlusIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-sm sm:text-base">{showForm ? 'إلغاء' : 'إضافة مستخدم جديد'}</span>
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="admin-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">إضافة مستخدم جديد</h3>
              <p className="text-sm text-white/70 mt-1">أدخل اسم المستخدم ورقم التليفون. الكود يُنشأ تلقائيًا بعد الإنشاء.</p>
            </div>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormData({ name: '', phone: '', subscriptionType: 'hour' }); }}
              className="text-white/60 hover:text-white"
              aria-label="إغلاق الفورم"
            >
              إغلاق
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">الاسم</label>
              <div className="relative group">
                <UserIcon className="w-5 h-5 text-white/60 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-emerald-400 transition-colors duration-300" />
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 border border-white/20 rounded-lg bg-white/5 backdrop-blur-sm text-white placeholder-white/60 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 hover:border-white/30"
                  placeholder="اكتب اسم المستخدم"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">التليفون</label>
              <div className="relative group">
                <PhoneIcon className="w-5 h-5 text-white/60 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-emerald-400 transition-colors duration-300" />
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 border border-white/20 rounded-lg bg-white/5 backdrop-blur-sm text-white placeholder-white/60 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 hover:border-white/30"
                  placeholder="اكتب رقم التليفون"
                />
              </div>
            </div>

            {/* عرض واضح لقائمة الاشتراكات */}
            <div className="sm:col-span-3 mt-4">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                    <ClockIcon className="w-5 h-5 text-emerald-400" />
                    قائمة الاشتراكات المتاحة
                  </h4>
                  <span className="text-xs text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-full">
                    اختر مدة الاشتراك
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {subscriptionOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, subscriptionType: option.value })}
                      className={`relative p-3 rounded-lg border transition-all duration-300 group ${formData.subscriptionType === option.value
                          ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/50 shadow-lg shadow-emerald-500/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                        }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className={`p-2 rounded-full ${formData.subscriptionType === option.value
                            ? 'bg-emerald-500/20'
                            : 'bg-white/10'
                          }`}>
                          {option.icon}
                        </div>
                        <span className={`text-sm font-medium ${formData.subscriptionType === option.value
                            ? 'text-emerald-300'
                            : 'text-white/80'
                          }`}>
                          {option.label}
                        </span>
                        <span className={`text-xs ${formData.subscriptionType === option.value
                            ? 'text-emerald-400'
                            : 'text-white/60'
                          }`}>
                          {option.duration}
                        </span>
                      </div>

                      {formData.subscriptionType === option.value && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full animate-ping opacity-75" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="sm:col-span-3 flex items-center justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormData({ name: '', phone: '', subscriptionType: 'hour' }); }}
                className="px-5 py-2.5 bg-white/6 text-white rounded-lg hover:bg-white/10 transition-all duration-300 border border-white/10 hover:border-white/20 flex items-center gap-2"
              >
                <XCircleIcon className="w-4 h-4" />
                إلغاء
              </button>
              <button
                type="submit"
                disabled={!formData.name || !formData.phone}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-500 hover:to-teal-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-emerald-500/25 flex items-center gap-2 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-white/10 to-teal-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <UserPlusIcon className="w-5 h-5 transition-transform duration-300" />
                <span className="relative">إنشاء مستخدم</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="admin-card p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 text-white/60 absolute right-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 border border-white/20 rounded-lg bg-white/5 backdrop-blur-sm text-white placeholder-white/60 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 hover:border-white/30"
                placeholder="ابحث عن مستخدم بالاسم، الكود أو رقم الهاتف..."
              />
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {/* Sort Order */}
            <div className="relative">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="appearance-none pl-8 pr-4 py-2 border border-white/20 rounded-lg bg-white/5 backdrop-blur-sm text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 hover:border-white/30 cursor-pointer"
              >
                <option value="newest" className="bg-gray-800">الأحدث أولاً</option>
                <option value="oldest" className="bg-gray-800">الأقدم أولاً</option>
              </select>
              <ArrowsUpDownIcon className="w-4 h-4 text-white/60 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
            
            {/* Subscription Status Filter */}
            <div className="relative">
              <select
                value={subscriptionFilter}
                onChange={(e) => setSubscriptionFilter(e.target.value)}
                className="appearance-none pl-8 pr-4 py-2 border border-white/20 rounded-lg bg-white/5 backdrop-blur-sm text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 hover:border-white/30 cursor-pointer"
              >
                <option value="all" className="bg-gray-800">جميع الاشتراكات</option>
                <option value="active" className="bg-gray-800">نشط</option>
                <option value="expired" className="bg-gray-800">منتهي</option>
                <option value="permanent" className="bg-gray-800">دائم</option>
              </select>
              <FunnelIcon className="w-4 h-4 text-white/60 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
            
            {/* Subscription Type Filter */}
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="appearance-none pl-8 pr-4 py-2 border border-white/20 rounded-lg bg-white/5 backdrop-blur-sm text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 hover:border-white/30 cursor-pointer"
              >
                <option value="all" className="bg-gray-800">جميع الأنواع</option>
                <option value="hour" className="bg-gray-800">ساعة</option>
                <option value="day" className="bg-gray-800">يوم</option>
                <option value="week" className="bg-gray-800">أسبوع</option>
                <option value="month" className="bg-gray-800">شهر</option>
                <option value="permanent" className="bg-gray-800">دائم</option>
              </select>
              <FunnelIcon className="w-4 h-4 text-white/60 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
            
            {/* Reset Filters Button */}
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-white/6 text-white rounded-lg hover:bg-white/10 transition-all duration-300 border border-white/10 hover:border-white/20 flex items-center gap-2"
            >
              <ArrowPathIcon className="w-4 h-4" />
              إعادة ضبط
            </button>
          </div>
        </div>
        
        {/* Results Count */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-white/70">
            عرض <span className="font-semibold text-white">{filteredUsers.length}</span> من أصل <span className="font-semibold text-white">{users.length}</span> مستخدم
          </div>
          {searchTerm && (
            <div className="text-sm text-emerald-400">
              نتائج البحث عن: "<span className="font-semibold">{searchTerm}</span>"
            </div>
          )}
        </div>
      </div>

      {/* Users List */}
      <div className="admin-card overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">قائمة المستخدمين <span className="text-sm text-white/70">({filteredUsers.length})</span></h2>
        </div>

        {loading ? (
          <div className="p-6 text-center text-white/70">جاري تحميل المستخدمين...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-6 text-center text-white/70">
            {searchTerm ? 'لا توجد نتائج مطابقة للبحث' : 'مافيش مستخدمين لحد دلوقتي'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Scrollable container with custom scrollbar */}
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
              <table dir="rtl" className="min-w-full table-fixed">
                <colgroup>
                  <col style={{ width: '260px' }} />
                  <col style={{ width: '180px' }} />
                  <col style={{ width: '220px' }} />
                  <col style={{ width: '140px' }} />
                  <col style={{ width: '200px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '180px' }} />
                </colgroup>
                <thead className="bg-white/5 border-b border-white/10 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-right align-middle text-sm font-semibold text-white/80 w-48">المعرف</th>
                    <th className="px-4 py-3 text-right align-middle text-sm font-semibold text-white/80 w-40">الاسم</th>
                    <th className="px-4 py-3 text-right align-middle text-sm font-semibold text-white/80 w-36">الكود</th>
                    <th className="px-4 py-3 text-right align-middle text-sm font-semibold text-white/80 w-36">مدة الاشتراك</th>
                    <th className="px-4 py-3 text-right align-middle text-sm font-semibold text-white/80 w-36">التليفون</th>
                    <th className="px-4 py-3 text-right align-middle text-sm font-semibold text-white/80 w-56">تاريخ الإنشاء</th>
                    <th className="px-4 py-3 text-center align-middle text-sm font-semibold text-white/80 w-44">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {filteredUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 align-middle text-sm text-white truncate whitespace-nowrap text-right">{user._id}</td>
                      <td className="px-4 py-3 align-middle text-sm text-white truncate whitespace-nowrap text-right">
                        {editUserId === user._id ? (
                          <input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="px-2 py-1 border border-white/15 rounded w-full bg-transparent text-white"
                          />
                        ) : (
                          <span className="truncate block">{user.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-sm text-white/80 truncate whitespace-nowrap text-right">
                        <div className="flex items-center gap-2">
                          <div className="font-mono font-semibold">{user.code}</div>
                          <button onClick={() => copyCode(user.code)} className="p-1 bg-white/6 rounded hover:bg-white/10" aria-label="نسخ كود المستخدم">
                            {copiedId === user.code ? (
                              <CheckIcon className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <DocumentDuplicateIcon className="w-4 h-4 text-white/90" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-sm text-white/70 truncate whitespace-nowrap text-right">
                        <div className="flex flex-col items-start">
                          <div className="text-sm font-semibold text-white/90">{getSubscriptionLabel(user.subscriptionType)}</div>
                          <div className={`text-xs mt-1 ${user.subscriptionType === 'permanent' ? 'text-emerald-400' : 
                            (user.subscriptionExpires && new Date(user.subscriptionExpires) > new Date() ? 'text-emerald-400' : 'text-rose-400')}`}>
                            {fmtRemaining(user)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-sm text-white/70 truncate whitespace-nowrap text-right">
                        {editUserId === user._id ? (
                          <input
                            value={editForm.phone}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            className="px-2 py-1 border border-white/15 rounded w-full bg-transparent text-white"
                          />
                        ) : (
                          <span className="truncate block">{user.phone}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-sm text-white/70 truncate whitespace-nowrap text-right">{user.createdAt ? new Date(user.createdAt).toLocaleString('ar-EG') : '-'}</td>
                      <td className="px-4 py-3 align-middle text-sm text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => { setSelectedUser(user); setShowModal(true); }}
                            className="p-2 bg-white/6 hover:bg-white/10 rounded-full text-white transition-shadow shadow-sm"
                            title="تفاصيل المستخدم"
                            aria-label={`تفاصيل ${user.name || user.code}`}
                          >
                            <InformationCircleIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      
      {/* Modal for user details and actions */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Full screen background */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => { handleCancelEdit(); setShowModal(false); setSelectedUser(null); setRenewTarget(null); setHistory(null); }} />
          
          {/* Modal content */}
          <div role="dialog" aria-modal="true" aria-label="تفاصيل المستخدم" className="relative w-full max-w-3xl mx-auto bg-gradient-to-b from-gray-800/95 to-gray-900/95 border border-white/10 rounded-2xl shadow-2xl p-6 animate-fadeIn overflow-y-auto max-h-[90vh] custom-scrollbar">
            {/* Close button */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                  <InformationCircleIcon className="w-7 h-7 text-emerald-300" />
                  تفاصيل المستخدم
                  <span className="text-sm ml-2 px-3 py-1 bg-emerald-600/20 text-emerald-200 rounded-full">{getSubscriptionLabel(selectedUser.subscriptionType)}</span>
                </h3>
                <p className="text-sm text-white/70 mt-2">بيانات المستخدم، سجل المشاهدات والاشتراكات، والإجراءات الممكن تنفيذها</p>
              </div>
              <button 
                onClick={() => { handleCancelEdit(); setShowModal(false); setSelectedUser(null); setRenewTarget(null); setHistory(null); }} 
                className="text-white/60 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* User Information Grid */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-white/60">المعرف</div>
                <div className="text-sm font-mono text-white/90 truncate p-2 bg-white/5 rounded mt-1">{selectedUser._id}</div>
              </div>
              <div>
                <div className="text-xs text-white/60">الكود</div>
                <div className="flex items-center gap-3 mt-1">
                  <div className="font-mono font-semibold text-white/90 p-2 bg-white/5 rounded flex-1">{selectedUser.code}</div>
                  <button onClick={() => copyCode(selectedUser.code)} className="p-2 bg-white/6 rounded-lg hover:bg-white/10 text-white transition-colors" title="نسخ الكود" aria-label="نسخ الكود">
                    {copiedId === selectedUser.code ? <CheckIcon className="w-4 h-4 text-emerald-400" /> : <DocumentDuplicateIcon className="w-4 h-4 text-white/90" />}
                  </button>
                </div>
              </div>
              <div>
                <div className="text-xs text-white/60">الاسم</div>
                <div className="text-sm text-white/90 mt-1">
                  {editUserId === selectedUser._id ? (
                    <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="px-3 py-2 rounded bg-white/5 text-white w-full border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                  ) : (
                    <div className="p-2 bg-white/5 rounded">{selectedUser.name}</div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-white/60">التليفون</div>
                <div className="text-sm text-white/90 mt-1">
                  {editUserId === selectedUser._id ? (
                    <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="px-3 py-2 rounded bg-white/5 text-white w-full border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                  ) : (
                    <div className="p-2 bg-white/5 rounded">{selectedUser.phone}</div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-white/60">نوع الاشتراك</div>
                <div className="text-sm text-white/90 p-2 bg-white/5 rounded mt-1">{getSubscriptionLabel(selectedUser.subscriptionType)}</div>
              </div>
              <div>
                <div className="text-xs text-white/60">الانتهاء</div>
                <div className="text-sm text-white/90 p-2 bg-white/5 rounded mt-1">{selectedUser.subscriptionType === 'permanent' ? 'دائم' : (selectedUser.subscriptionExpires ? new Date(selectedUser.subscriptionExpires).toLocaleString('ar-EG') : '—')}</div>
              </div>
              <div>
                <div className="text-xs text-white/60">تاريخ الإنشاء</div>
                <div className="text-sm text-white/90 p-2 bg-white/5 rounded mt-1">{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString('ar-EG') : '-'}</div>
              </div>
              <div>
                <div className="text-xs text-white/60">إذن التحميل</div>
                <div className="text-sm text-white/90 p-2 bg-white/5 rounded mt-1 flex items-center justify-between">
                  <div>{selectedUser.canDownloadVideos ? <span className="text-emerald-300">مسموح بالتحميل</span> : <span className="text-rose-300">محظور التحميل</span>}</div>
                  <div>
                    <button
                      onClick={async () => {
                        try {
                          const newVal = !selectedUser.canDownloadVideos;
                          await authAPI.updateUser(selectedUser._id, undefined, undefined, newVal);
                          await loadUsers();
                          // reload selected user details
                          try {
                            const res = await authAPI.getUserById(selectedUser._id);
                            const u = res?.data?.user || res?.data || null;
                            if (u) setSelectedUser(u);
                          } catch (e) { }
                          toast.success(newVal ? 'تم تفعيل تحميل الفيديو لهذا المستخدم' : 'تم تعطيل تحميل الفيديو لهذا المستخدم', { position: 'top-right', autoClose: 2500 });
                        } catch (err) {
                          toast.error('فشل تحديث إذن التحميل', { position: 'top-right', autoClose: 3000 });
                        }
                      }}
                      className={`px-3 py-1 text-sm rounded-lg ${selectedUser.canDownloadVideos ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white`}
                    >
                      {selectedUser.canDownloadVideos ? 'إلغاء السماح' : 'السماح بالتحميل'}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs text-white/60">حالة الجهاز</div>
                <div className="text-sm text-white/90 p-2 bg-white/5 rounded mt-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      {selectedUser.deviceId ? (
                        <span className="text-emerald-300">مسجل بالفعل على متصفح</span>
                      ) : (
                        <span className="text-amber-300">لم يسجل بعد (أول دخول متاح)</span>
                      )}
                    </div>
                    <div>
                      <button
                        onClick={() => setShowResetConfirm(true)}
                        className="px-3 py-1 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                      >
                        إعادة تعيين
                      </button>
                    </div>
                  </div>

                  {/* Inline confirmation panel */}
                  {showResetConfirm && (
                    <div className="mt-3 p-3 bg-white/6 border border-white/10 rounded-lg flex items-center justify-between gap-4">
                      <div className="text-sm text-white/80">هل أنت متأكد من إعادة تعيين جهاز هذا المستخدم؟ سيُلغى الوصول من المتصفح الحالي فوراً.</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            if (!selectedUser) return;
                            try {
                              setResetLoading(true);
                              await resetDeviceForUser(selectedUser._id);
                            } finally {
                              setResetLoading(false);
                              setShowResetConfirm(false);
                            }
                          }}
                          disabled={resetLoading}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg"
                        >
                          {resetLoading ? 'جاري المعالجة...' : 'تأكيد'}
                        </button>
                        <button
                          onClick={() => setShowResetConfirm(false)}
                          className="px-3 py-1 bg-white/6 hover:bg-white/10 text-white rounded-lg"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Renew Subscription Section - INSIDE MODAL - Only show for expired subscriptions */}
            {(() => {
              const isExpired = selectedUser.subscriptionType !== 'permanent' && 
                                selectedUser.subscriptionExpires && 
                                new Date(selectedUser.subscriptionExpires) <= new Date();
              
              return isExpired ? (
                <div className="mt-6 p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                      <ClockIcon className="w-5 h-5 text-emerald-300" />
                      تجديد الاشتراك
                    </h4>
                    <span className="text-xs text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-full">
                      اختر مدة جديدة
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {subscriptionOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => renewSubscription(selectedUser._id, option.value)}
                        className={`relative p-3 rounded-lg border transition-all duration-300 group ${selectedUser.subscriptionType === option.value
                            ? 'bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border-emerald-500/50 shadow-lg shadow-emerald-500/20'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                          }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className={`p-2 rounded-full ${selectedUser.subscriptionType === option.value
                              ? 'bg-emerald-500/20'
                              : 'bg-white/10'
                            }`}>
                            {option.icon}
                          </div>
                          <span className={`text-sm font-medium ${selectedUser.subscriptionType === option.value
                              ? 'text-emerald-300'
                              : 'text-white/80'
                            }`}>
                            {option.label}
                          </span>
                          <span className={`text-xs ${selectedUser.subscriptionType === option.value
                              ? 'text-emerald-400'
                              : 'text-white/60'
                            }`}>
                            {option.duration}
                          </span>
                        </div>

                        {selectedUser.subscriptionType === option.value && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full animate-ping opacity-75" />
                        )}
                      </button>
                    ))}
                  </div>
                  
                  <div className="mt-3 text-xs text-white/60 text-center">
                    سيتم إضافة المدة الجديدة إلى وقت انتهاء الاشتراك الحالي
                  </div>
                </div>
              ) : null;
            })()}

            {/* History tabs */}
            <div className="mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setHistoryTab('views')}
                    className={`w-full sm:w-auto px-4 py-2 rounded-lg transition-colors ${historyTab === 'views' ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`}>
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      <VideoCameraIcon className="w-4 h-4" />
                      <span>سجل المشاهدات</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setHistoryTab('subscriptions')}
                    className={`w-full sm:w-auto px-4 py-2 rounded-lg transition-colors ${historyTab === 'subscriptions' ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`}>
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      <CalendarDaysIcon className="w-4 h-4" />
                      <span>سجل الاشتراكات</span>
                    </div>
                  </button>
                </div>

                <div className="ml-0 sm:ml-auto flex items-center gap-2 w-full sm:w-auto">
                  <button onClick={() => loadUserHistory(selectedUser._id)} className="w-full sm:w-auto p-2 bg-white/6 rounded-lg hover:bg-white/10 text-white transition-colors" title="تحديث السجل" aria-label="تحديث السجل">
                    <ArrowPathIcon className="w-5 h-5 mx-auto sm:mx-0" />
                  </button>
                </div>
              </div>

              <div className="mt-3 bg-white/5 p-4 rounded-lg max-h-60 overflow-y-auto custom-scrollbar">
                {loadingHistory ? (
                  <div className="flex items-center justify-center p-4">
                    <div className="text-white/80">جارٍ تحميل السجل...</div>
                  </div>
                ) : !history ? (
                  <div className="text-white/70 text-center p-4">لا يوجد سجل عرض حالياً. اضغط "تحديث السجل" لتحميله.</div>
                ) : historyTab === 'views' ? (
                  <div className="space-y-3">
                    {((history.lectureViews || []).length + (history.pdfViews || []).length) === 0 ? (
                      <div className="text-white/70 text-center p-4">لا توجد مشاهدات لهذا المستخدم.</div>
                    ) : (
                      <>
                        {/* Video views removed - video functionality has been removed from the project */}
                        {history.lectureViews && history.lectureViews.map((l) => (
                          <div key={`lv-${l._id}`} className="flex items-start gap-3 text-sm text-white/80 border-b border-white/8 py-3">
                            <button
                              onClick={async () => {
                                const lectureId = l.lectureId?._id || l.lectureId;
                                try {
                                  const res = await videosAPI.getVideosByLecture(lectureId);
                                  const vids = res.data || [];
                                  if (vids.length === 0) {
                                    toast.info('لا يوجد فيديو مرتبط بهذه المحاضرة');
                                    return;
                                  }
                                  setPlayingVideo(vids[0]);
                                  setShowVideoPlayer(true);
                                } catch (err) {
                                  toast.error('فشل جلب بيانات الفيديو');
                                }
                              }}
                              className="p-2 bg-white/6 rounded-full hover:bg-white/10 text-white flex-shrink-0"
                              title="تشغيل المحاضرة"
                              aria-label={`تشغيل ${l.lectureId?.title || 'المحاضرة'}`}>
                              <PlayIcon className="w-5 h-5 text-sky-300" />
                            </button>
                            <div className="flex-1">
                              <div className="font-medium">محاضرة: <span className="text-white">{l.lectureId?.title || '—'}</span></div>
                              <div className="text-xs text-white/60 mt-1">تاريخ: {new Date(l.createdAt).toLocaleString('ar-EG')}</div>
                            </div>
                          </div>
                        ))}
                        {history.pdfViews && history.pdfViews.map((p) => (
                          <div key={`pv-${p._id}`} className="flex items-start gap-3 text-sm text-white/80 border-b border-white/8 py-3">
                            <DocumentTextIcon className="w-5 h-5 text-purple-300 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="font-medium">ملف PDF: <span className="text-white">{p.pdfId?.title || '—'}</span></div>
                              <div className="text-xs text-white/60 mt-1">تاريخ: {new Date(p.createdAt).toLocaleString('ar-EG')}</div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(!history.subscriptions || history.subscriptions.length === 0) ? (
                      <div className="text-white/70 text-center p-4">لا توجد سجلات اشتراك.</div>
                    ) : (
                      history.subscriptions.map((s) => (
                        <div key={s._id} className="text-sm text-white/80 border-b border-white/8 py-3">
                          <div className="font-medium text-white">{getSubscriptionLabel(s.type)}</div>
                          <div className="text-xs text-white/60 mt-1">بواسطة: {s.adminId || 'نظام'}</div>
                          <div className="text-xs text-white/60">التاريخ: {new Date(s.createdAt).toLocaleString('ar-EG')}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex items-center gap-3 justify-end pt-4 border-t border-white/10">
              {editUserId === selectedUser._id ? (
                <>
                  <button onClick={() => handleSaveEdit(selectedUser._id)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2">
                    <CheckIcon className="w-4 h-4" /> حفظ
                  </button>
                  <button onClick={handleCancelEdit} className="px-4 py-2 bg-white/6 text-white rounded-lg hover:bg-white/10 transition-colors">إلغاء</button>
                </>
              ) : (
                <>
                  <button onClick={() => { handleEditClick(selectedUser); }} className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors flex items-center gap-2">
                    <PencilSquareIcon className="w-4 h-4" /> تعديل
                  </button>
                  <button onClick={() => { openDeleteConfirm(selectedUser); }} className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors flex items-center gap-2">
                    <TrashIcon className="w-4 h-4" /> حذف
                  </button>
                </>
              )}
              
            </div>
          </div>
        </div>
      )}

        {/* Video Player Modal for history playback */}
        {showVideoPlayer && playingVideo && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => { setShowVideoPlayer(false); setPlayingVideo(null); }} />
            <div className="relative w-full max-w-4xl mx-auto bg-transparent p-4">
              <div className="bg-gradient-to-b from-gray-900/95 to-gray-900/95 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white font-semibold">{playingVideo.title || 'تشغيل الفيديو'}</div>
                  <button onClick={() => { setShowVideoPlayer(false); setPlayingVideo(null); }} className="text-white/60 hover:text-white p-2 rounded-full">
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
                <VideoPlayer video={playingVideo} />
              </div>
            </div>
          </div>
        )}

      {/* Custom Styles */}
      <style jsx="true">{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.12s cubic-bezier(.2,.9,.3,1) both;
        }

        /* Base scrollbar for Firefox */
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(16,185,129,0.85) rgba(15,23,42,0.16);
        }

        /* WebKit browsers (Chrome, Edge, Safari) */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15,23,42,0.08);
          border-radius: 999px;
          margin: 6px 0;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #10b981 0%, #06b6d4 100%);
          border-radius: 999px;
          border: 2px solid rgba(0,0,0,0.06);
          box-shadow: 0 1px 0 rgba(255,255,255,0.02) inset;
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }

        /* Hover / active states for better affordance */
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          transform: scale(1.05);
          box-shadow: 0 0 10px rgba(16,185,129,0.12), 0 0 0 1px rgba(255,255,255,0.02) inset;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:active {
          transform: scale(1.08);
          box-shadow: 0 0 14px rgba(16,185,129,0.18), 0 0 0 1px rgba(255,255,255,0.03) inset;
        }

        /* Make sure very long scrollbars remain rounded and subtle */
        .custom-scrollbar::-webkit-scrollbar-corner {
          background: transparent;
        }
      `}</style>
    </div>
  );
};

export default UsersManagement;