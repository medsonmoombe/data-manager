import { message } from 'antd';

export function showApiErrors(err: any): void {
  const data = err?.response?.data;
  if (data?.errors?.length) {
    data.errors.forEach((e: string) => message.error(e));
  } else {
    message.error(data?.message || 'Something went wrong');
  }
}

export function showImportResult(data: any): void {
  const msg = data?.message;
  const stats = data?.stats;
  if (!stats) {
    message.success(msg || 'Import completed.');
    return;
  }
  const hasDuplicates = (stats.blockedDuplicates ?? stats.skipped ?? 0) > 0;
  const hasNew = stats.newRecords > 0;
  const hasUpdated = stats.updatedRecords > 0;
  if (hasDuplicates && !hasNew && !hasUpdated) {
    message.warning(msg, 8);
  } else if (hasDuplicates) {
    message.warning(msg, 8);
  } else {
    message.success(msg, 5);
  }
}
