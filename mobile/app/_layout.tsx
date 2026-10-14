import '../src/i18n';
import { useEffect } from 'react';
import { Slot, useRouter } from 'expo-router';
import { routeFor, useSession } from '../src/auth/useSession';

export default function RootLayout() {
  const session = useSession();
  const router = useRouter();
  const target = routeFor(session);

  useEffect(() => {
    router.replace(target as never);
  }, [target, router]);

  return <Slot />;
}
