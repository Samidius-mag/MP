'use client';

import Layout from '@/components/layout/Layout';
import SimaLandProducts from '@/components/client/SimaLandProducts';

export default function SimaLandPage() {
  return (
    <Layout requiredRole="client">
      <SimaLandProducts />
    </Layout>
  );
}

