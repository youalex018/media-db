import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Search, Library, User, LogOut, Menu, X, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/api';
import { ShelfIcon } from '@/components/ShelfIcon';

export function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    localStorage.removeItem('sb-fake-session');
    await supabase.auth.signOut();
    window.location.href = '/auth'; // Force full reload to clear any memory state/hooks
  };

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
          isActive
            ? 'bg-timber-300/10 text-timber-300 font-medium'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`
      }
      onClick={() => setIsMobileMenuOpen(false)}
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );

  return (
    <div className="flex h-screen overflow-hidden flex-col md:flex-row bg-background">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border/50">
        <div className="font-bold text-xl text-timber-300">
          Shelflife
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-card/80 backdrop-blur-sm border-r border-border/50 transform transition-transform duration-200 ease-in-out md:relative md:transform-none
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full p-4">
          <div className="hidden md:flex items-center gap-3 px-2 py-4 mb-4">
            <ShelfIcon className="h-9 w-9" />
            <span className="font-bold text-xl text-timber-300">
              Shelflife
            </span>
          </div>

          <nav className="space-y-1 flex-1">
            <NavItem to="/search" icon={Search} label="Search" />
            <NavItem to="/library" icon={Library} label="Library" />
            <NavItem to="/discover" icon={Sparkles} label="Discover" />
            <NavItem to="/community" icon={Users} label="Community" />
          </nav>

          <Separator className="my-4 bg-border/50" />

          <div className="space-y-1">
            <NavItem to="/profile" icon={User} label="Profile" />
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-4 md:p-8 max-w-5xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
