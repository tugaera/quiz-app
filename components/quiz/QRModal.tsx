// components/quiz/QRModal.tsx — QR code dialog for session join link
"use client";

import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface QRModalProps {
  sessionId: string;
  trigger?: React.ReactNode;
}

export function QRModal({ sessionId, trigger }: QRModalProps) {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "");
  const joinUrl = `${base}/play/${sessionId}`;

  return (
    <Dialog>
      <DialogTrigger>
        {trigger ?? <Button variant="outline">Show QR Code</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan to Join</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="bg-white p-4 rounded-lg">
            <QRCodeSVG value={joinUrl} size={256} level="H" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">Or go to:</p>
            <code className="text-sm bg-muted px-3 py-1 rounded break-all">
              {joinUrl}
            </code>
          </div>
          <Button
            variant="secondary"
            onClick={() => navigator.clipboard.writeText(joinUrl)}
          >
            Copy Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
