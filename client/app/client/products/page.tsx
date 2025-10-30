'use client';

import Layout from '@/components/layout/Layout';
import StoreProducts from '@/components/client/StoreProducts';

export default function ProductsPage() {
  return (
    <Layout requiredRole="client">
      <StoreProducts />
    </Layout>
  );
}

