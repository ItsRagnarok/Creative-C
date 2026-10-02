import PublicBooking from "@/components/PublicBooking";

export default async function PersonalBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicBooking slug={slug} />;
}
