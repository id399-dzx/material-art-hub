import { redirect } from 'next/navigation';
import { batteryAppIsAvailable } from '@/lib/battery-app';
import connection from '@/lib/battery-app-origin.json';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const available = await batteryAppIsAvailable(process.env.BATTERY_APP_ORIGIN ?? connection.origin, 'https://fesilent.com/');
  redirect(available ? '/battery' : '/reverie');
}
