"use client";
import Link from 'next/link';
import { SignInButton, SignUpButton, UserButton, SignedIn, SignedOut } from '@clerk/nextjs';
import { useState } from 'react';

export default function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <nav className="navbar-responsive" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 32px',
        borderBottom: '1px solid #eee',
        marginBottom: 24,
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        background: '#fff',
        zIndex: 100,
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link href="/" style={{ fontWeight: 'bold', fontSize: 22, textDecoration: 'none', color: 'inherit' }}>
            Sindh Test Prep
          </Link>
        </div>
        {/* Hamburger icon for mobile */}
        <button
          className={`navbar-hamburger${menuOpen ? ' open' : ''}`}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          aria-controls="navbar-menu"
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            fontSize: 28,
            cursor: 'pointer',
            marginLeft: 12,
            padding: 4,
          }}
        >
          {/* SVG Hamburger Icon */}
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect className="bar top" x="6" y="10" width="20" height="3" rx="1.5" fill="#1d4ed8" />
            <rect className="bar middle" x="6" y="15" width="20" height="3" rx="1.5" fill="#1d4ed8" />
            <rect className="bar bottom" x="6" y="20" width="20" height="3" rx="1.5" fill="#1d4ed8" />
          </svg>
        </button>
        {/* Nav links */}
        <div id="navbar-menu" className={`navbar-links${menuOpen ? ' open' : ''}`} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          transition: 'all 0.2s',
        }}>
          <Link href="/practice">Practice</Link>
          <SignedIn>
            <Link href="/dashboard">Dashboard</Link>
          </SignedIn>
          <Link href="/news">News</Link>
          <SignedOut>
            <SignInButton />
            <SignUpButton />
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
        {/* Responsive styles and hamburger animation */}
        <style>{`
          @media (max-width: 600px) {
            .navbar-responsive {
              padding: 12px 4vw !important;
              height: 60px !important;
            }
            .navbar-hamburger {
              display: block !important;
              transition: transform 0.3s cubic-bezier(.4,2,.6,1);
            }
            .navbar-hamburger svg {
              display: block;
            }
            .navbar-hamburger .bar {
              transition: all 0.3s cubic-bezier(.4,2,.6,1);
            }
            .navbar-hamburger.open {
              transform: rotate(90deg);
            }
            .navbar-hamburger.open .bar.top {
              transform: translateY(5px) rotate(45deg);
            }
            .navbar-hamburger.open .bar.middle {
              opacity: 0;
            }
            .navbar-hamburger.open .bar.bottom {
              transform: translateY(-5px) rotate(-45deg);
            }
            .navbar-links {
              display: none !important;
              position: absolute !important;
              top: 100%;
              left: 0;
              width: 100vw;
              background: #fff;
              flex-direction: column !important;
              align-items: flex-start !important;
              gap: 0 !important;
              box-shadow: 0 2px 12px rgba(0,0,0,0.08);
              border-bottom-left-radius: 12px;
              border-bottom-right-radius: 12px;
              padding: 8px 0 12px 0;
              z-index: 99;
            }
            .navbar-links.open {
              display: flex !important;
            }
            .navbar-links a, .navbar-links button {
              width: 100%;
              text-align: left;
              padding: 12px 24px;
              font-size: 17px;
              background: none;
              border: none;
              color: #1d4ed8;
              font-weight: 500;
              text-decoration: none;
              cursor: pointer;
            }
            .navbar-links a:active, .navbar-links button:active {
              background: #f1f5f9;
            }
          }
        `}</style>
      </nav>
      {/* Spacer to prevent content from being hidden under the fixed navbar */}
      <div style={{ height: 72 }} className="navbar-spacer"></div>
    </>
  );
} 