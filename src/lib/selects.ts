// Shared PostgREST select strings, so every page and every live update loads rows in exactly the same shape.
export const OWNER_SELECT = "*, owner:profiles(id, full_name, initials)";
export const OWNER_LEAD_SELECT = "*, owner:profiles(id, full_name, initials), lead:leads(id, name)";
export const BOOKING_SELECT =
  "*, owner:profiles!bookings_owner_id_fkey(id, full_name, initials), link:booking_links(slug, link_owner:profiles!booking_links_link_owner_id_fkey(id, full_name, initials))";
export const MESSAGE_SELECT = "*, author:profiles(id, full_name, initials)";
