'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { QrCode, Smartphone } from 'lucide-react'

import { Button, buttonVariants } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { formatMoney } from '@settlr/shared/format'
import { cn } from '#/lib/utils'

// Paying over UPI (India): a upi://pay link opens GPay, PhonePe, Paytm or
// any UPI app with the payee and amount filled in. On a computer, the QR
// code is the same link for a phone to scan. Only for INR.

export function upiLink({
  upiId,
  name,
  amountCents,
  note,
}: {
  upiId: string
  name: string
  amountCents: number
  note: string
}) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: name,
    am: (amountCents / 100).toFixed(2),
    cu: 'INR',
    tn: note.slice(0, 50),
  })
  return `upi://pay?${params.toString()}`
}

/**
 * "Pay with UPI": a link for phones and a QR code for computers. Record the
 * payment in Settlr afterwards (UPI apps don't report back).
 */
export function UpiPay({
  upiId,
  name,
  amountCents,
  note = 'Settlr settle-up',
  size = 'default',
}: {
  upiId: string
  name: string
  amountCents: number
  note?: string
  size?: 'default' | 'sm'
}) {
  const link = upiLink({ upiId, name, amountCents, note })
  const [svg, setSvg] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    let live = true
    QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(
      (out) => live && setSvg(out),
      () => live && setSvg(null),
    )
    return () => {
      live = false
    }
  }, [open, link])

  return (
    <span className="inline-flex gap-1.5">
      <a
        href={link}
        className={cn(buttonVariants({ variant: 'outline', size }), 'no-underline lg:hidden')}
      >
        <Smartphone />
        Pay with UPI
      </a>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" size={size} />}>
          <QrCode />
          <span className="hidden lg:inline">Pay with UPI</span>
          <span className="sr-only lg:hidden">UPI QR code</span>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pay {name} {formatMoney(amountCents, 'INR')}</DialogTitle>
            <DialogDescription>
              Scan with any UPI app. Then record the payment here so the balance updates.
            </DialogDescription>
          </DialogHeader>
          <div className="grid justify-items-center gap-3 pt-2">
            <div
              className="size-56 rounded-lg bg-white p-2 [&_svg]:size-full"
              // The SVG comes from the qrcode library, not from user HTML.
              dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
            />
            <p className="text-xs text-muted-foreground">{upiId}</p>
          </div>
        </DialogContent>
      </Dialog>
    </span>
  )
}
