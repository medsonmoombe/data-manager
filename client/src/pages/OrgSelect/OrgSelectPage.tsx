import React, { useEffect, useState } from 'react';
import { Card, Spin, Result, Button } from 'antd';
import { ApartmentOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { organizationsApi } from '../../api/organizations.api';

export default function OrgSelectPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const setOrgId = useAuthStore((s) => s.setOrgId);
  const navigate = useNavigate();

  useEffect(() => {
    organizationsApi
      .list()
      .then((res: any) => {
        const data = Array.isArray(res) ? res : res?.data || [];
        setOrgs(data);
        if (data.length === 1) {
          handleSelect(data[0].id);
          return;
        }
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const handleSelect = async (orgId: string) => {
    setSelecting(orgId);
    setOrgId(orgId);
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <Result
          status="warning"
          title="Could not load organizations"
          subTitle="Check your connection and try again"
          extra={
            <Button type="primary" onClick={() => window.location.reload()} className="!bg-[#009B3A]">
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#009B3A] to-[#E8611D] flex items-center justify-center text-white text-xl font-bold font-mono mx-auto mb-4">
            OC
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">
            Select your workspace
          </h1>
          <p className="text-sm text-gray-400">
            Choose an organization to continue
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {orgs.map((org) => (
            <Card
              key={org.id}
              hoverable
              loading={selecting === org.id}
              className={`!rounded-xl !border !border-gray-200 !shadow-sm transition-all ${
                selecting === org.id ? '!opacity-60' : 'hover:!border-[#009B3A] hover:!shadow-md'
              }`}
              onClick={() => handleSelect(org.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#009B3A] to-[#00B844] flex items-center justify-center text-white text-sm flex-shrink-0">
                  <ApartmentOutlined />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900">{org.name}</div>
                  {org.domain && (
                    <div className="text-[11px] text-gray-400">{org.domain}</div>
                  )}
                </div>
                <ArrowRightOutlined className="text-gray-300 text-sm" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
