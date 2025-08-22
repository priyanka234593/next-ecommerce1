'use client';
 
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
 
// Session storage helpers
const getReportedPages = (): string[] => {
  const data = sessionStorage.getItem('reportedPages');
  return data ? JSON.parse(data) : [];
};
 
const saveReportedPage = (path: string) => {
  const pages = getReportedPages();
  if (!pages.includes(path)) {
    pages.push(path);
    sessionStorage.setItem('reportedPages', JSON.stringify(pages));
  }
};
 
// Detect OS and browser version
const detectOSAndBrowser = async (): Promise<{ os: string; browserVersion: string }> => {
  let os = 'Unknown OS';
  let browserVersion = 'Unknown';
  try {
    const nav: any = navigator;
    if (nav.userAgentData) {
      const uaData = await nav.userAgentData.getHighEntropyValues([
        'platform',
        'platformVersion',
        'uaFullVersion',
      ]);
      const major = parseInt(uaData.platformVersion.split('.')[0]);
      os = uaData.platform === 'Windows' ? (major >= 13 ? 'Windows 11' : 'Windows 10 or earlier') : uaData.platform;
      browserVersion = uaData.uaFullVersion;
    } else {
      const ua = navigator.userAgent;
      if (ua.includes('Windows NT 10.0')) os = 'Windows 10 / 11';
      else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1';
      else if (ua.includes('Mac OS X')) os = 'macOS';
      else if (ua.includes('Linux')) os = 'Linux';
      browserVersion = (ua.match(/Chrome\/([0-9.]+)/) || [])[1] || 'Unknown';
    }
  } catch {}
  return { os, browserVersion };
};
 
// Simple bot detection
const isBot = (ua: string): boolean => /bot|crawler|spider|crawl|slurp|robot|fetch/i.test(ua);
 
// IST timestamp
const getISTTimestamp = (): string => {
  const now = new Date();
  const istOffset = 330;
  const localTime = new Date(now.getTime() + istOffset * 60000 - now.getTimezoneOffset() * 60000);
  return localTime.toISOString().replace('T', ' ').split('.')[0];
};
 
// Validate email format
const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
 
export default function TrafficReporter() {
  const pathname = usePathname();
  const reportedRef = useRef<Set<string>>(new Set());
 
  useEffect(() => {
    if (!pathname) return;
 
    let action = 'PageVisit';
    if (pathname.includes('login')) action = 'LoginAttempt';
    else if (pathname.includes('signup') || pathname.includes('register')) action = 'SignupAttempt';
    else if (pathname.includes('cart')) action = 'CartPageVisit';
 
    if (reportedRef.current.has(pathname)) return;
 
    const alreadyReported = getReportedPages();
    if (alreadyReported.includes(pathname)) return;
 
    const reportPayload = async (extraData: Record<string, any> = {}) => {
      const { os, browserVersion } = await detectOSAndBrowser();
      const userAgent = navigator.userAgent;
      const payload = {
        url: window.location.href,
        userAgent,
        timestamp: getISTTimestamp(),
        action,
        os,
        browserVersion,
        bot: isBot(userAgent),
        ...extraData,
      };
 
      fetch('https://zap-api-dev.shaeryldatatech.in/firewall/static', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors',
      }).catch(err => console.warn('⚠️ Traffic reporting failed:', err));
    };
 
    // Report page visit
    const timeout = setTimeout(() => {
      reportPayload();
      saveReportedPage(pathname);
      reportedRef.current.add(pathname);
    }, 200);
 
    // Track suspicious input
    const inputHandler = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const value = (target.value || '').toString();
      const field = target.name || target.type;
 
      // Validate email format safely
      if (field.toLowerCase().includes('email') && !isValidEmail(value)) {
        reportPayload({ invalidEmail: value, field });
      }
 
      // Track suspicious characters (XSS attempts)
      if (/[<>]|script|onerror|onload|javascript:|data:/i.test(value)) {
        reportPayload({ suspiciousInput: value, field });
      }
    };
 
    // Track file uploads
    const fileHandler = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const files = target.files;
      if (files && files.length > 0) {
        for (const file of Array.from(files)) {
          reportPayload({ uploadedFile: file.name, fileType: file.type, fileSize: file.size });
        }
      }
    };
 
    // Track login/signup form submissions
    const submitHandler = async (e: Event) => {
      const form = e.target as HTMLFormElement;
      if (!form) return;
 
      const inputs = form.querySelectorAll('input');
      const data: Record<string, any> = {};
      inputs.forEach(input => {
        const inp = input as HTMLInputElement;
        if (inp.type !== 'password') {
          data[inp.placeholder || inp.name || inp.type] = inp.value;
        }
      });
 
      const isSignup = form.dataset.track === 'signup';
      await reportPayload(isSignup ? { signupAttempt: data } : { loginAttempt: data });
    };
 
    document.addEventListener('input', inputHandler, true);
    document.addEventListener('change', fileHandler, true);
    document.addEventListener('submit', submitHandler, true);
 
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('input', inputHandler, true);
      document.removeEventListener('change', fileHandler, true);
      document.removeEventListener('submit', submitHandler, true);
    };
  }, [pathname]);
 
  return null;
}
