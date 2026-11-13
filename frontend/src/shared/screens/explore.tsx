import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { supabase } from '@/backend/src/supabase';
import { ProductCatalog } from '@/frontend/src/shared/screens/product-catalog';

export default function ExploreScreen() {
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function verifyAccess() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        router.replace('/' as Href);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user.id)
        .maybeSingle();

      if (!isActive) return;
      if (profile?.status === 'active') {
        setIsAuthorized(true);
      } else {
        router.replace('/pending' as Href);
      }
    }

    void verifyAccess();
    return () => { isActive = false; };
  }, []);

  if (!isAuthorized) {
    return <ActivityIndicator style={styles.accessLoader} />;
  }

  return <ProductCatalog />;
}

const styles = StyleSheet.create({
  accessLoader: { flex: 1, color: '#1028D8' },
});
