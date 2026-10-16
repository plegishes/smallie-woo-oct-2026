import { forwardRef } from 'react';

export interface ReceiptItem {
  categoryTitle: string;
  giftName: string;
  price: number;
}

interface ReceiptImageProps {
  customerName: string;
  businessName: string;
  purpose: string;
  logoSrc?: string | null;
  items: ReceiptItem[];
}

function formatPrice(price: number) {
  return `EUR ${price.toFixed(2)}`;
}

function formatBarcodeValue(items: ReceiptItem[]) {
  const seed = items
    .map((item) => `${item.categoryTitle}-${item.giftName}-${item.price}`)
    .join('|')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase();

  return (seed || 'BRYANMENSAHRECEIPT').slice(0, 28);
}

export const ReceiptImage = forwardRef<HTMLDivElement, ReceiptImageProps>(function ReceiptImage(
  { customerName, businessName, purpose, logoSrc, items },
  ref,
) {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const date = new Date();
  const dateLabel = date.toLocaleDateString('en-GB');
  const timeLabel = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const barcodeValue = formatBarcodeValue(items);

  return (
    <div ref={ref} className="receipt-export">
      <div className="receipt-export__stack" aria-hidden="true" />
      <article className="receipt-paper">
        <header className="receipt-paper__header">
          <h1>HBD SMALLIE WOO</h1>
          <span>•••••</span>
        </header>

        <div className="receipt-paper__meta">
          <span>{dateLabel}</span>
          <span>{timeLabel}</span>
        </div>

        <div className="receipt-paper__business">
          <div className="receipt-paper__logo-wrap">
            {logoSrc ? <img src={logoSrc} alt={customerName} className="receipt-paper__logo" /> : <div className="receipt-paper__logo receipt-paper__logo--empty" />}
            <div>
              <p>
                <strong>Customer:</strong> {customerName}
              </p>
              <p>
                <strong>Business:</strong> {businessName}
              </p>
            </div>
          </div>
          <p>
            <strong>Purpose:</strong> {purpose}
          </p>
        </div>

        <div className="receipt-paper__divider" />

        <div className="receipt-paper__items">
          {items.map((item) => (
            <div key={`${item.categoryTitle}-${item.giftName}`} className="receipt-paper__item">
              <div className="receipt-paper__item-copy">
                <strong>{item.giftName}</strong>
                <span>{item.categoryTitle}</span>
              </div>
              <strong>{formatPrice(item.price)}</strong>
            </div>
          ))}
        </div>

        <div className="receipt-paper__divider" />

        <div className="receipt-paper__totals">
          <div className="receipt-paper__totals-row">
            <span>Items</span>
            <span>{items.length}</span>
          </div>
          <div className="receipt-paper__totals-row receipt-paper__totals-row--main">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
          <div className="receipt-paper__totals-row receipt-paper__totals-row--subtle">
            <span>Note</span>
            <span>Yenyin roff.</span>
          </div>
        </div>

        <div className="receipt-paper__card">
          <div className="receipt-paper__card-row">
            <span>Cash Out</span>
            <span>{formatPrice(total)}</span>
          </div>
          <div className="receipt-paper__card-row receipt-paper__card-row--subtle">
            <span>{dateLabel}</span>
            <span>{timeLabel}</span>
          </div>
          <div className="receipt-paper__card-row receipt-paper__card-row--subtle">
            <span>#Transaction</span>
            <span>{barcodeValue}</span>
          </div>
        </div>

        <footer className="receipt-paper__footer">
          <p>•••• THANK YOU ••••</p>
          <div className="receipt-paper__barcode" aria-hidden="true">
            {barcodeValue.split('').map((character, index) => (
              <span
                key={`${character}-${index}`}
                style={{
                  width: index % 3 === 0 ? '4px' : index % 2 === 0 ? '2px' : '3px',
                }}
              />
            ))}
          </div>
        </footer>
      </article>
    </div>
  );
});
