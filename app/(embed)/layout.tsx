import '@/app/globals.css'

export const metadata = {
  title: 'Relationship Intelligence — HubSpot',
}

/**
 * Minimal layout for the HubSpot iframe embed.
 * No sidebar, no nav — just the content filling the iframe.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white h-screen overflow-hidden">{children}</body>
    </html>
  )
}
