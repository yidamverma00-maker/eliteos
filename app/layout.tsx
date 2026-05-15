import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'EliteOS',
  description: 'Autonomous Hybrid Athlete Intelligence System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, background: '#080c12' }}>
        {children}
      </body>
    </html>
  )
}
