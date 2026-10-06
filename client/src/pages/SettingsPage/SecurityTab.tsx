import React, { useState, useEffect } from 'react';
import { Card, Switch, Typography, message, Spin, Descriptions, Tag } from 'antd';
import { SafetyOutlined, MailOutlined, CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../stores/auth.store';

const { Text } = Typography;

/**
 * Security Tab
 *
 * Allows users to enable/disable two-factor authentication (email OTP).
 * Shows current 2FA status and provides a toggle to change it.
 */
export default function SecurityTab() {
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [otpEnabled, setOtpEnabled] = useState(false);
  const user = useAuthStore((s) => s.user);
  useEffect(() => {
    loadSecurityStatus();
  }, []);

  const loadSecurityStatus = async () => {
    setLoading(true);
    try {
      const profile = await authApi.getMe();
      console.log("PROFILE ::", profile)
      setOtpEnabled(profile.otpEnabled);
    } catch (err: any) {
      console.error('Failed to load security status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle2FA = async (checked: boolean) => {
    setToggling(true);
    try {
      const result = await authApi.toggle2FA(checked);
      setOtpEnabled(checked);
      message.success(result.message || (checked ? 'Two-factor authentication enabled.' : 'Two-factor authentication disabled.'));
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Failed to update 2FA settings.';
      message.error(msg);
    } finally {
      setToggling(false);
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

  return (
    <div className="flex flex-col gap-4 max-w-[600px]">
      {/* 2FA Section */}
      <Card
        size="small"
        bodyStyle={{ padding: 20 }}
        style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(0,155,58,0.08)] flex items-center justify-center flex-shrink-0">
              <SafetyOutlined className="text-[#009B3A] text-lg" />
            </div>
            <div>
              <h4 className="text-[13px] font-bold m-0 text-[#1A1F2E]">Two-Factor Authentication</h4>
              <Text className="text-[11px] text-[#99A1B3]">
                Add an extra layer of security to your account
              </Text>
            </div>
          </div>
          <Switch
            checked={otpEnabled}
            onChange={handleToggle2FA}
            loading={toggling}
            className="!bg-[#D1D5DB]"
            checkedChildren="ON"
            unCheckedChildren="OFF"
          />
        </div>

        <div className="mt-4 p-3 rounded-lg bg-[#F9FAFB] border border-[#F3F4F6]">
          <div className="flex items-center gap-2 mb-2">
            <MailOutlined className="text-[#009B3A] text-sm" />
            <span className="text-[11px] font-semibold text-[#374151]">Email Verification Code</span>
          </div>
          <p className="text-[11px] text-[#6B7280] m-0 leading-relaxed">
            When enabled, you'll receive a 6-digit verification code via email each time you sign in.
            Enter the code to complete your login.
          </p>
        </div>

        {otpEnabled && (
          <div className="mt-3 p-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
            <div className="flex items-center gap-2">
              <CheckCircleOutlined className="text-[#16A34A] text-sm" />
              <span className="text-[11px] font-semibold text-[#16A34A]">2FA is active on your account</span>
            </div>
            <p className="text-[10px] text-[#6B7280] m-0 mt-1">
              You'll be asked for a verification code every time you sign in from a new device or session.
            </p>
          </div>
        )}

        {!otpEnabled && (
          <div className="mt-3 p-3 rounded-lg bg-[#FFFBEB] border border-[#FDE68A]">
            <div className="flex items-center gap-2">
              <InfoCircleOutlined className="text-[#D97706] text-sm" />
              <span className="text-[11px] font-semibold text-[#92400E]">2FA is not enabled</span>
            </div>
            <p className="text-[10px] text-[#6B7280] m-0 mt-1">
              Your account is protected by password only. Enable 2FA for enhanced security.
            </p>
          </div>
        )}
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
          <Descriptions.Item label="Email">{user?.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="User ID">
            <Tag className="!text-[9px] !font-mono">{user?.sub?.substring(0, 8)}...</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="2FA Status">
            <Tag color={otpEnabled ? 'green' : 'default'} className="!text-[9px]">
              {otpEnabled ? 'Enabled' : 'Disabled'}
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
            { tip: 'Use a unique password that you don\'t use elsewhere', done: true },
            { tip: 'Enable two-factor authentication for extra protection', done: otpEnabled },
            { tip: 'Never share your verification codes with anyone', done: true },
            { tip: 'Contact your admin if you suspect unauthorized access', done: true },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <CheckCircleOutlined
                className={`text-sm ${item.done ? 'text-[#009B3A]' : 'text-[#D1D5DB]'}`}
              />
              <span className={item.done ? 'text-[#374151]' : 'text-[#9CA3AF]'}>{item.tip}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
