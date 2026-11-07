import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  FileUp,
  RotateCcw,
  ShieldAlert,
  Bot,
  Settings,
  X,
  Sparkles
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'My Purchases', path: '/purchases', icon: ShoppingBag },
  { name: 'Upload Invoice', path: '/upload-invoice', icon: FileUp },
  { name: 'Returns & Exchanges', path: '/returns', icon: RotateCcw },
  { name: 'Warranty Alerts', path: '/warranties', icon: ShieldAlert },
  { name: 'AI Assistant', path: '/ai-assistant', icon: Bot },
  { name: 'Settings', path: '/settings', icon: Settings },
];

const Sidebar = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0F172A] text-white flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white shadow-md shadow-purple-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">
              SMART<span className="text-[#7C3AED]">RETURN</span>
            </span>
          </div>
          {/* Close button on mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#7C3AED] text-white shadow-sm shadow-purple-900/50'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Workspace Info footer */}
        <div className="p-4 border-t border-slate-800/80">
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
            <p className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Phase 5 SaaS Production Ready
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Automated Alerts & Recovery</p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
