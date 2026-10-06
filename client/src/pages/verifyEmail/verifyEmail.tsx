import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Spin, message } from 'antd';
import { FiCheckCircle, FiAlertCircle, FiArrowRight, FiMail } from 'react-icons/fi';
import { authApi } from '../../api/auth.api';

/**
 * Email Verification Page
 * 
 * This page handles email verification when users click the link
 * in their verification email.
 * 
 * URL: /verify-email?token=xxx&client_id=frontend
 */
export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    verifyEmail();
  }, []);

  const verifyEmail = async () => {
    const token = searchParams.get('token');
    
    if (!token) {
      setState('error');
      setErrorMsg('No verification token found. Please request a new verification email.');
      return;
    }

    try {
      await authApi.verifyEmail(token);
      setState('success');
      message.success('Email verified successfully!');
    } catch (err: any) {
      setState('error');
      setErrorMsg(
        err?.response?.data?.message || err?.message || 'Failed to verify email. The link may have expired.',
      );
    }
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F4F8]">
        <div className="text-center">
          <Spin size="small" />
          <p className="text-sm text-[#99A1B3] mt-3">Verifying your email...</p>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F4F8] p-4">
        <div className="bg-white rounded-2xl p-10 max-w-[480px] w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-[#F0FDF4] rounded-full flex items-center justify-center mx-auto mb-5">
            <FiCheckCircle className="text-3xl text-[#009B3A]" />
          </div>
          <h2 className="text-xl font-bold text-[#1A1F2E] font-[Space_Grotesk] mb-2">Email Verified!</h2>
          <p className="text-sm text-[#5F6880] mb-6">
            Your email has been successfully verified. You can now sign in to your account.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#009B3A] text-white rounded-lg text-sm font-semibold hover:bg-[#007A2E] transition-all no-underline"
          >
            Go to Login <FiArrowRight />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F4F8] p-4">
      <div className="bg-white rounded-2xl p-10 max-w-[480px] w-full text-center shadow-lg">
        <div className="w-16 h-16 bg-[#FEF2F2] rounded-full flex items-center justify-center mx-auto mb-5">
          <FiAlertCircle className="text-3xl text-[#CE1126]" />
        </div>
        <h2 className="text-xl font-bold text-[#1A1F2E] font-[Space_Grotesk] mb-2">Verification Failed</h2>
        <p className="text-sm text-[#5F6880] mb-6">{errorMsg}</p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#009B3A] text-white rounded-lg text-sm font-semibold hover:bg-[#007A2E] transition-all no-underline"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}