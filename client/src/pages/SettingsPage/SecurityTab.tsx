import { useState, useEffect } from 'react';
import { Card, Typography, Spin, Descriptions, Tag, Button } from 'antd';
import { SafetyOutlined, CheckCircleOutlined, CloseCircleOutlined, MailOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { authApi, type UserProfile } from '../../api/auth.api';
import { useAuthStore } from '../../stores/auth.store';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

/**
 * Security Tab
 *
 * Account security overview. Two-factor authentication is no longer offered:
 * sign-in is email/password only, and emailed one-time links are used solely
 * for password resets and email verification.
 */
export default function SecurityTab() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    loadSecurityStatus();
  }, []);

  const loadSecurityStatus = async () => {
    setLoading(true);
    try {
      setProfile(await authApi.getMe());
    } catch (err: any) {
      console.error('Failed to load security status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setSending(true);
    try {
      const result = await authApi.resendVerification();
      message.success(result.message || 'Verification email sent.');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to send verification email.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spin size="small" />
        <span className="text-[12px] text-[#99A1B3] ml-3">Loading security settings...</span>
      </div>
    );
  }

  const emailVerified = profile?.emailVerified ?? false;

  return (
    <div className="flex flex-col gap-4 max-w-[600px]">
      {/* Authentication */}
      <Card
        size="small"
        bodyStyle={{ padding: 20 }}
        style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(0,155,58,0.08)] flex items-center justify-center flex-shrink-0">
            <SafetyOutlined className="text-[#009B3A] text-lg" />
          </div>
          <div className="flex-1">
            <h4 className="text-[13px] font-bold m-0 text-[#1A1F2E]">Sign-in &amp; password</h4>
            <Text className="text-[11px] text-[#99A1B3]">
              Your account is protected by an email and password sign-in.
            </Text>

            <div className="mt-3 flex items-center gap-2">
              <Button
                size="small"
                onClick={() => navigate('/change-password')}
                className="!text-[11px]"
              >
                Change password
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Email verification */}
      <Card
        size="small"
        bodyStyle={{ padding: 20 }}
        style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(0,155,58,0.08)] flex items-center justify-center flex-shrink-0">
              <MailOutlined className="text-[#009B3A] text-lg" />
            </div>
            <div>
              <h4 className="text-[13px] font-bold m-0 text-[#1A1F2E]">Email verification</h4>
              <Text className="text-[11px] text-[#99A1B3]">
                {emailVerified
                  ? 'Your email address has been verified.'
                  : 'Please verify your email address.'}
              </Text>
            </div>
          </div>
          {emailVerified ? (
            <Tag color="green" className="!text-[9px] !m-0">Verified</Tag>
          ) : (
            <Button size="small" loading={sending} onClick={handleResendVerification} className="!text-[11px]">
              Resend link
            </Button>
          )}
        </div>
      </Card>

      {/* Account Info */}
      <Card
        size="small"
        bodyStyle={{ padding: 20 }}
        style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}
      >
        <h4 className="text-[13px] font-bold m-0 text-[#1A1F2E] mb-3">Account Security Info</h4>
        <Descriptions size="small" column={1} bordered
          labelStyle={{ fontSize: 11, width: 140 }}
          contentStyle={{ fontSize: 11 }}>
          <Descriptions.Item label="Email">{profile?.email || user?.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="User ID">
            <Tag className="!text-[9px] !font-mono">{user?.sub?.substring(0, 8)}...</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Email Verified">
            <Tag color={emailVerified ? 'green' : 'default'} className="!text-[9px]">
              {emailVerified ? 'Verified' : 'Unverified'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Password">
            <Tag color="green" className="!text-[9px]">Set</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Security Tips */}
      <Card
        size="small"
        bodyStyle={{ padding: 20 }}
        style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}
      >
        <h4 className="text-[13px] font-bold m-0 text-[#1A1F2E] mb-3">Security Tips</h4>
        <div className="flex flex-col gap-2">
          {[
            { tip: "Use a unique password that you don't use elsewhere", done: true },
            { tip: 'Verify your email address to secure account recovery', done: emailVerified },
            { tip: 'Never share your password reset links with anyone', done: true },
            { tip: 'Contact your admin if you suspect unauthorized access', done: true },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              {item.done ? (
                <CheckCircleOutlined className="text-sm text-[#009B3A]" />
              ) : (
                <CloseCircleOutlined className="text-sm text-[#D1D5DB]" />
              )}
              <span className={item.done ? 'text-[#374151]' : 'text-[#9CA3AF]'}>{item.tip}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
