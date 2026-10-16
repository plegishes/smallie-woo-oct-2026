import { ArrowLeft, ArrowRight, Camera, Download, Heart, LoaderCircle, Lock, Pause, Play, RotateCcw, Save, Upload } from 'lucide-react';
import { type CSSProperties, type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  createDefaultExperienceConfig,
  DEFAULT_INTRO_VIDEO_PATH,
  loadExperienceConfig,
  saveExperienceConfig,
  serializeExperienceConfig,
  type ExperienceCategoryConfig,
  type ExperienceConfig,
} from './experience-config';
import type { ReceiptItem } from './receipt-image';
import type { CategoryKey, GiftOption } from './types';

const ADMIN_PATH = '/studio-audio';
const ADMIN_PASSWORD = 'bryan-birthday';
const CUSTOMER_NAME = 'Bryan Mensah';
const BUSINESS_NAME = 'Araba Mansa Sagoe';
const RECEIPT_PURPOSE = 'Yedi 31 ooo. Yenyin roff.';
const PAGE_BACKGROUND_PATH = '/images/page-bg.jpg';
const CATEGORY_CARD_SHADES = ['#e4efff', '#d7e7ff', '#c8dcff', '#b9d2ff'] as const;
const WHEEL_SEGMENT_COLORS = ['#f4f8ff', '#e9f0ff', '#dde8ff', '#d0dfff', '#c3d7ff', '#b5ceff'] as const;
const UI_SOUND_PATHS = [
  '/audio/ui/10k-trim-p4.mp3',
  '/audio/ui/anaa-me-mebodam-trim-p5.mp3',
  '/audio/ui/anyway-trim-p1.mp3',
  '/audio/ui/fu-nigga-trim-p2.mp3',
  '/audio/ui/i-beg-come-and-save-me-trim-p3.mp3',
  '/audio/ui/laughs-trim.mp3',
  '/audio/ui/massa-trim-p5.mp3',
  '/audio/ui/nigga-what-trim-p2.mp3',
  '/audio/ui/we-will-rock-you-trim-p5.mp3',
  '/audio/ui/what-it-is-trim-p3.mp3',
  '/audio/ui/wofa-nono-trim-p2.mp3',
  '/audio/ui/you-see-your-life-trim.mp3',
] as const;
const AUDIO_INDICATOR_AVATAR_PATHS = [
  '/images/pill-avatars/pill-avatar-1.jpg',
  '/images/pill-avatars/pill-avatar-2.jpg',
  '/images/pill-avatars/pill-avatar-3.jpg',
  '/images/pill-avatars/pill-avatar-4.jpg',
  '/images/pill-avatars/pill-avatar-5.jpg',
] as const;
const AUDIO_INDICATOR_CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

type ExperienceStep = 'memo' | 'categories' | 'wheel' | 'selfie' | 'cashout';
type AudioIndicatorCorner = (typeof AUDIO_INDICATOR_CORNERS)[number];

function polarToCartesian(centerX: number, centerY: number, radius: number, angleDegrees: number) {
  const angleRadians = ((angleDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleRadians),
    y: centerY + radius * Math.sin(angleRadians),
  };
}

function describeArc(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  return `M ${centerX} ${centerY} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function wrapWheelIndex(index: number, total: number) {
  return ((index % total) + total) % total;
}

function easeOutQuart(value: number) {
  return 1 - (1 - value) ** 4;
}

function getActiveIndexFromRotation(rotation: number, slice: number, total: number) {
  const normalized = wrapWheelIndex(Math.floor((360 - (rotation % 360) + 360) % 360 / slice), total);
  return normalized;
}

function createGiftState(categories: ExperienceCategoryConfig[]) {
  return categories.reduce<Record<CategoryKey, GiftOption | null>>((accumulator, category) => {
    accumulator[category.key] = null;
    return accumulator;
  }, {} as Record<CategoryKey, GiftOption | null>);
}

function createSpinAttemptState(categories: ExperienceCategoryConfig[]) {
  return categories.reduce<Record<CategoryKey, number>>((accumulator, category) => {
    accumulator[category.key] = 0;
    return accumulator;
  }, {} as Record<CategoryKey, number>);
}

function getPickedFilePath(file: File, input: HTMLInputElement) {
  const fileWithPath = file as File & { path?: string; filepath?: string };
  const directPath = fileWithPath.path || fileWithPath.filepath;
  if (directPath) {
    return directPath;
  }

  return input.value || file.name;
}

function withBasePath(path: string) {
  if (!path) {
    return path;
  }

  if (/^(?:[a-z]+:|\/\/)/i.test(path)) {
    return path;
  }

  const normalizedPath = path.replace(/^\/+/, '');
  if (typeof window === 'undefined') {
    return `/${normalizedPath}`;
  }

  const normalizedAdminPath = normalizeRoutePath(ADMIN_PATH);
  const normalizedLocationPath = normalizeRoutePath(window.location.pathname);
  let sitePath = window.location.pathname;

  if (normalizedLocationPath.endsWith(normalizedAdminPath)) {
    sitePath = window.location.pathname.slice(0, window.location.pathname.length - normalizedAdminPath.length) || '/';
  }

  if (!sitePath.endsWith('/')) {
    sitePath = `${sitePath}/`;
  }

  return new URL(normalizedPath, `${window.location.origin}${sitePath}`).toString();
}

function resolveAssetPath(path: string) {
  if (/^[a-zA-Z]:\\/.test(path)) {
    return `file:///${path.replace(/\\/g, '/')}`;
  }

  if (path.startsWith('\\\\')) {
    return `file:${path.replace(/\\/g, '/')}`;
  }

  return withBasePath(path);
}

function normalizeRoutePath(path: string) {
  const normalized = path.replace(/\/+$/, '');
  return normalized || '/';
}

function isAdminRoute() {
  const normalizedAdminPath = normalizeRoutePath(ADMIN_PATH);
  const normalizedPathname = normalizeRoutePath(window.location.pathname);
  const normalizedHash = normalizeRoutePath(window.location.hash.replace(/^#/, ''));

  return normalizedPathname.endsWith(normalizedAdminPath) || normalizedHash === normalizedAdminPath;
}

function getAdjustedImagePosition(categoryKey: CategoryKey, imagePosition: string) {
  if (categoryKey === 'likeDontNeed') {
    return imagePosition;
  }

  const match = imagePosition.match(/^(.*?)(-?\d+(?:\.\d+)?)%$/);
  if (!match) {
    return imagePosition;
  }

  const [, prefix, rawPercent] = match;
  return `${prefix}${Number.parseFloat(rawPercent) - 30}%`;
}

function getGainDbFromAudioPath(path: string) {
  const match = path.match(/-p(\d+)(?=\.[^.]+$)/i);
  return match ? Number.parseInt(match[1] || '0', 10) : 0;
}

function getGainMultiplierFromDb(db: number) {
  return 10 ** (db / 20);
}

function giftLinesToText(gifts: GiftOption[]) {
  return gifts.map((gift) => `${gift.name} | ${gift.price}`).join('\n');
}

function parseGiftLines(rawValue: string) {
  return rawValue
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [namePart, pricePart] = line.split('|');
      return {
        name: (namePart || '').trim(),
        price: Number.parseFloat((pricePart || '0').trim()) || 0,
      };
    })
    .filter((gift) => gift.name.length > 0);
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatReceiptPrice(price: number) {
  return `EUR ${price.toFixed(2)}`;
}

function formatReceiptBarcode(items: ReceiptItem[]) {
  const seed = items
    .map((item) => `${item.categoryTitle}-${item.giftName}-${item.price}`)
    .join('|')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase();

  return (seed || 'BRYANMENSAHRECEIPT').slice(0, 28);
}

async function loadCanvasImage(src: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image: ${src}`));
    image.src = src;
  });
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || currentLine.length === 0) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;

    if (lines.length === maxLines - 1) {
      break;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  const trimmedLines = lines.slice(0, maxLines).map((line, index) => {
    if (index < maxLines - 1 || lines.length <= maxLines) {
      return line;
    }

    let nextLine = line;
    while (context.measureText(`${nextLine}…`).width > maxWidth && nextLine.length > 1) {
      nextLine = nextLine.slice(0, -1).trimEnd();
    }
    return `${nextLine}…`;
  });

  trimmedLines.forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });

  return y + Math.max(trimmedLines.length - 1, 0) * lineHeight;
}

function drawReceiptBarcode(context: CanvasRenderingContext2D, value: string, x: number, y: number, height: number) {
  let cursor = x;

  value.split('').forEach((_, index) => {
    const width = index % 3 === 0 ? 8 : index % 2 === 0 ? 4 : 6;
    context.fillRect(cursor, y, width, height);
    cursor += width + 3;
  });
}

async function renderReceiptPng({
  backgroundSrc,
  logoSrc,
  customerName,
  businessName,
  purpose,
  items,
}: {
  backgroundSrc: string;
  logoSrc?: string | null;
  customerName: string;
  businessName: string;
  purpose: string;
  items: ReceiptItem[];
}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 1280;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas is not available.');
  }

  context.clearRect(0, 0, canvas.width, canvas.height);

  try {
    const backgroundImage = await loadCanvasImage(backgroundSrc);
    context.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
  } catch {
    context.fillStyle = '#1f66ff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const stackX = 410;
  const stackY = 130;
  const stackWidth = 470;
  const stackHeight = 1020;

  context.save();
  context.translate(stackX + stackWidth / 2, stackY + stackHeight / 2);
  context.rotate((6 * Math.PI) / 180);
  context.fillStyle = 'rgba(255, 255, 255, 0.92)';
  context.strokeStyle = '#111111';
  context.lineWidth = 4;
  context.fillRect(-stackWidth / 2, -stackHeight / 2, stackWidth, stackHeight);
  context.strokeRect(-stackWidth / 2, -stackHeight / 2, stackWidth, stackHeight);
  context.restore();

  const receiptX = 350;
  const receiptY = 110;
  const receiptWidth = 595;
  const receiptHeight = 1030;

  context.fillStyle = '#fbfbfb';
  context.strokeStyle = '#111111';
  context.lineWidth = 4;
  context.fillRect(receiptX, receiptY, receiptWidth, receiptHeight);
  context.strokeRect(receiptX, receiptY, receiptWidth, receiptHeight);

  context.fillStyle = '#1c1c1c';
  context.textAlign = 'center';
  context.font = "bold 66px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
  context.fillText('HBD SMALLIE WOO', receiptX + receiptWidth / 2, receiptY + 88);
  context.font = "16px 'Courier New', monospace";
  context.fillText('•••••', receiptX + receiptWidth / 2, receiptY + 116);

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-GB');
  const timeLabel = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const barcodeValue = formatReceiptBarcode(items);
  const total = items.reduce((sum, item) => sum + item.price, 0);

  context.globalAlpha = 0.65;
  context.font = "16px 'Courier New', monospace";
  context.fillText(`${dateLabel}     ${timeLabel}`, receiptX + receiptWidth / 2, receiptY + 145);
  context.globalAlpha = 1;

  let cursorY = receiptY + 190;
  const contentLeft = receiptX + 32;
  const contentRight = receiptX + receiptWidth - 32;

  if (logoSrc) {
    try {
      const logoImage = await loadCanvasImage(logoSrc);
      context.save();
      context.beginPath();
      context.arc(contentLeft + 28, cursorY + 28, 28, 0, Math.PI * 2);
      context.closePath();
      context.clip();
      context.drawImage(logoImage, contentLeft, cursorY, 56, 56);
      context.restore();
      context.strokeStyle = 'rgba(17, 17, 17, 0.12)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(contentLeft + 28, cursorY + 28, 28, 0, Math.PI * 2);
      context.stroke();
    } catch {
      context.fillStyle = '#e7e7e7';
      context.beginPath();
      context.arc(contentLeft + 28, cursorY + 28, 28, 0, Math.PI * 2);
      context.fill();
    }
  } else {
    context.fillStyle = '#e7e7e7';
    context.beginPath();
    context.arc(contentLeft + 28, cursorY + 28, 28, 0, Math.PI * 2);
    context.fill();
  }

  context.textAlign = 'left';
  context.fillStyle = '#1c1c1c';
  context.font = "bold 14px 'Courier New', monospace";
  context.fillText('Customer:', contentLeft + 70, cursorY + 18);
  context.font = "14px 'Courier New', monospace";
  context.fillText(customerName, contentLeft + 150, cursorY + 18);
  context.font = "bold 14px 'Courier New', monospace";
  context.fillText('Business:', contentLeft + 70, cursorY + 40);
  context.font = "14px 'Courier New', monospace";
  context.fillText(businessName, contentLeft + 150, cursorY + 40);

  cursorY += 82;
  context.font = "bold 14px 'Courier New', monospace";
  context.fillText('Purpose:', contentLeft, cursorY);
  context.font = "14px 'Courier New', monospace";
  drawWrappedText(context, purpose, contentLeft + 78, cursorY, contentRight - (contentLeft + 78), 18, 2);

  cursorY += 28;
  context.strokeStyle = 'rgba(17, 17, 17, 0.18)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(contentLeft, cursorY);
  context.lineTo(contentRight, cursorY);
  context.stroke();

  cursorY += 28;

  items.forEach((item) => {
    context.textAlign = 'left';
    context.font = "bold 16px 'Courier New', monospace";
    drawWrappedText(context, item.giftName, contentLeft, cursorY, 330, 18, 2);
    context.globalAlpha = 0.62;
    context.font = "12px 'Courier New', monospace";
    context.fillText(item.categoryTitle, contentLeft, cursorY + 19);
    context.globalAlpha = 1;

    context.textAlign = 'right';
    context.font = "bold 16px 'Courier New', monospace";
    context.fillText(formatReceiptPrice(item.price), contentRight, cursorY + 2);

    cursorY += 44;
  });

  cursorY += 4;
  context.strokeStyle = 'rgba(17, 17, 17, 0.18)';
  context.beginPath();
  context.moveTo(contentLeft, cursorY);
  context.lineTo(contentRight, cursorY);
  context.stroke();

  cursorY += 30;
  context.textAlign = 'left';
  context.font = "14px 'Courier New', monospace";
  context.fillText('Items', contentLeft, cursorY);
  context.textAlign = 'right';
  context.fillText(String(items.length), contentRight, cursorY);

  cursorY += 28;
  context.textAlign = 'left';
  context.font = "bold 30px 'Courier New', monospace";
  context.fillText('Total', contentLeft, cursorY);
  context.textAlign = 'right';
  context.fillText(formatReceiptPrice(total), contentRight, cursorY);

  cursorY += 28;
  context.globalAlpha = 0.62;
  context.textAlign = 'left';
  context.font = "14px 'Courier New', monospace";
  context.fillText('Note', contentLeft, cursorY);
  context.textAlign = 'right';
  context.fillText('Yenyin roff.', contentRight, cursorY);
  context.globalAlpha = 1;

  cursorY += 44;
  context.strokeStyle = '#111111';
  context.lineWidth = 2;
  context.strokeRect(contentLeft, cursorY, contentRight - contentLeft, 92);
  context.font = "14px 'Courier New', monospace";
  context.textAlign = 'left';
  context.fillText('Cash Out', contentLeft + 16, cursorY + 24);
  context.textAlign = 'right';
  context.fillText(formatReceiptPrice(total), contentRight - 16, cursorY + 24);
  context.globalAlpha = 0.68;
  context.textAlign = 'left';
  context.fillText(dateLabel, contentLeft + 16, cursorY + 48);
  context.textAlign = 'right';
  context.fillText(timeLabel, contentRight - 16, cursorY + 48);
  context.textAlign = 'left';
  context.fillText('#Transaction', contentLeft + 16, cursorY + 72);
  context.textAlign = 'right';
  context.fillText(barcodeValue, contentRight - 16, cursorY + 72);
  context.globalAlpha = 1;

  context.textAlign = 'center';
  context.font = "16px 'Courier New', monospace";
  context.fillText('•••• THANK YOU ••••', receiptX + receiptWidth / 2, receiptY + receiptHeight - 88);
  drawReceiptBarcode(context, barcodeValue, receiptX + 150, receiptY + receiptHeight - 64, 46);

  context.fillStyle = '#fbfbfb';
  const tearY = receiptY + receiptHeight;
  const toothWidth = 18;
  for (let x = receiptX; x <= receiptX + receiptWidth; x += toothWidth) {
    context.beginPath();
    context.moveTo(x, tearY);
    context.lineTo(x + toothWidth / 2, tearY + 16);
    context.lineTo(x + toothWidth, tearY);
    context.closePath();
    context.fill();
  }

  return canvas.toDataURL('image/png');
}

function ActionButton({
  label,
  detail,
  icon,
  tone = 'soft',
  onClick,
  disabled,
}: {
  label: string;
  detail?: string;
  icon?: ReactNode;
  tone?: 'primary' | 'soft' | 'ghost';
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`step-action step-action--${tone}`.trim()}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="step-action__icon">{icon}</span>
      <span className="step-action__copy">
        <strong>{label}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
    </button>
  );
}

function PublicExperience({ pageBackgroundImage }: { pageBackgroundImage: string }) {
  const [experienceConfig] = useState<ExperienceConfig>(() => loadExperienceConfig());
  const categories = experienceConfig.categories;
  const [currentStep, setCurrentStep] = useState<ExperienceStep>('memo');
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<CategoryKey>('likeDontNeed');
  const [selectedGifts, setSelectedGifts] = useState<Record<CategoryKey, GiftOption | null>>(() => createGiftState(categories));
  const [spinAttempts, setSpinAttempts] = useState<Record<CategoryKey, number>>(() => createSpinAttemptState(categories));
  const [isSpinning, setIsSpinning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isIntroPlaying, setIsIntroPlaying] = useState(false);
  const [isIntroBuffering, setIsIntroBuffering] = useState(false);
  const [showIntroControls, setShowIntroControls] = useState(true);
  const [isIntroReadyToContinue, setIsIntroReadyToContinue] = useState(false);
  const [showIntroGreeting, setShowIntroGreeting] = useState(true);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [selfieLogoSrc, setSelfieLogoSrc] = useState<string | null>(null);
  const [resolvedIntroVideoPath, setResolvedIntroVideoPath] = useState(() => resolveAssetPath(experienceConfig.introVideoPath));
  const resolvedIntroPosterPath = useMemo(() => resolveAssetPath(experienceConfig.introPosterPath), [experienceConfig.introPosterPath]);
  const introVideoRef = useRef<HTMLVideoElement | null>(null);
  const introWasPausedByUserRef = useRef(false);
  const shouldResumeIntroAfterBufferRef = useRef(false);
  const wheelAnimationFrameRef = useRef<number | null>(null);
  const wheelRotationRef = useRef(0);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.key === selectedCategoryKey) ?? categories[0],
    [categories, selectedCategoryKey],
  );
  const selectedGift = selectedGifts[selectedCategoryKey];
  const selectedCategorySpinAttempts = spinAttempts[selectedCategoryKey] ?? 0;
  const completedCount = Object.values(selectedGifts).filter(Boolean).length;
  const allCategoriesLocked = completedCount === categories.length;
  const wheelGiftCount = selectedCategory.gifts.length;
  const wheelSlice = wheelGiftCount > 0 ? 360 / wheelGiftCount : 360;
  const selectedGiftIndex = selectedGift
    ? selectedCategory.gifts.findIndex((gift) => gift.name === selectedGift.name && gift.price === selectedGift.price)
    : -1;
  const activeWheelIndex = wheelGiftCount === 0 ? 0 : getActiveIndexFromRotation(wheelRotation, wheelSlice, wheelGiftCount);
  const centeredWheelItems =
    wheelGiftCount === 0
      ? []
      : [-2, -1, 0, 1, 2].map((offset) => {
          const index = wrapWheelIndex(activeWheelIndex + offset, wheelGiftCount);
          return {
            gift: selectedCategory.gifts[index],
            index,
            offset,
          };
        });
  const receiptItems = categories.reduce<ReceiptItem[]>((accumulator, category) => {
    const gift = selectedGifts[category.key];
    if (!gift) {
      return accumulator;
    }

    accumulator.push({
      categoryTitle: category.title,
      giftName: gift.name,
      price: gift.price,
    });

    return accumulator;
  }, []);

  useEffect(() => {
    if (currentStep !== 'categories') {
      return;
    }

    if (selectedGifts[selectedCategoryKey]) {
      const nextOpenCategory = categories.find((category) => !selectedGifts[category.key]);
      if (nextOpenCategory) {
        setSelectedCategoryKey(nextOpenCategory.key);
      }
    }
  }, [currentStep, selectedCategoryKey, selectedGifts]);

  useEffect(() => {
    setResolvedIntroVideoPath(resolveAssetPath(experienceConfig.introVideoPath));
  }, [experienceConfig.introVideoPath]);

  useEffect(() => {
    if (wheelAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(wheelAnimationFrameRef.current);
      wheelAnimationFrameRef.current = null;
    }
    setWheelRotation(0);
    wheelRotationRef.current = 0;
    setIsSpinning(false);
  }, [selectedCategoryKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowIntroGreeting(false);
    }, 6000);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!introVideoRef.current) {
      return;
    }

    const video = introVideoRef.current;
    const updateIntroReadyState = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        setIsIntroReadyToContinue(false);
        return;
      }

      setIsIntroReadyToContinue(video.duration - video.currentTime <= 3);
    };

    updateIntroReadyState();
    video.addEventListener('loadedmetadata', updateIntroReadyState);
    video.addEventListener('timeupdate', updateIntroReadyState);
    video.addEventListener('ended', updateIntroReadyState);

    return () => {
      video.removeEventListener('loadedmetadata', updateIntroReadyState);
      video.removeEventListener('timeupdate', updateIntroReadyState);
      video.removeEventListener('ended', updateIntroReadyState);
    };
  }, [experienceConfig.introVideoPath, showIntroGreeting]);

  useEffect(() => {
    return () => {
      if (wheelAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(wheelAnimationFrameRef.current);
      }
    };
  }, []);

  function handleStartCategories() {
    if (allCategoriesLocked) {
      setCurrentStep('selfie');
      return;
    }

    setCurrentStep('categories');
  }

  function handleOpenPane(categoryKey: CategoryKey) {
    if (selectedGifts[categoryKey]) {
      return;
    }

    setSelectedCategoryKey(categoryKey);
    setCurrentStep('wheel');
  }

  function handleSelectGift() {
    if (isSpinning || selectedCategorySpinAttempts >= 2 || selectedCategory.gifts.length === 0) {
      return;
    }

    const gifts = selectedCategory.gifts;
    const availableIndices = gifts
      .map((_, index) => index)
      .filter((index) => !(selectedCategorySpinAttempts > 0 && selectedGiftIndex >= 0 && gifts.length > 1 && index === selectedGiftIndex));
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)] ?? 0;
    const segmentCenterOffset = (randomIndex + 0.5) * wheelSlice;
    const startRotation = wheelRotationRef.current;
    const targetRotation = startRotation + 1800 + 360 - segmentCenterOffset;
    const spinDuration = 4400;

    setIsSpinning(true);

    const startedAt = performance.now();

    const animateWheel = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(elapsed / spinDuration, 1);
      const easedProgress = easeOutQuart(progress);
      const nextRotation = startRotation + (targetRotation - startRotation) * easedProgress;

      wheelRotationRef.current = nextRotation;
      setWheelRotation(nextRotation);

      if (progress < 1) {
        wheelAnimationFrameRef.current = window.requestAnimationFrame(animateWheel);
        return;
      }

      wheelAnimationFrameRef.current = null;
      wheelRotationRef.current = targetRotation;
      setWheelRotation(targetRotation);
      const landedIndex = getActiveIndexFromRotation(targetRotation, wheelSlice, gifts.length);
      setSelectedGifts((current) => ({
        ...current,
        [selectedCategoryKey]: gifts[landedIndex],
      }));
      setSpinAttempts((current) => ({
        ...current,
        [selectedCategoryKey]: (current[selectedCategoryKey] ?? 0) + 1,
      }));
      setIsSpinning(false);
    };

    if (wheelAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(wheelAnimationFrameRef.current);
    }

    wheelAnimationFrameRef.current = window.requestAnimationFrame(animateWheel);
  }

  function handleBackToCategories() {
    setCurrentStep('categories');
  }

  function handleBack() {
    if (currentStep === 'memo') {
      return;
    }

    if (currentStep === 'categories') {
      setCurrentStep('memo');
      return;
    }

    if (currentStep === 'wheel') {
      handleBackToCategories();
      return;
    }

    if (currentStep === 'selfie') {
      setCurrentStep('categories');
      return;
    }

    setCurrentStep('selfie');
  }

  function handleAdvanceFromWheel() {
    if (!selectedGift) {
      return;
    }

    const nextCategory =
      categories.find((category) => !selectedGifts[category.key] && category.key !== selectedCategoryKey) ??
      categories.find((category) => !selectedGifts[category.key]);

    if (!nextCategory) {
      setCurrentStep('selfie');
      return;
    }

    setSelectedCategoryKey(nextCategory.key);
    setCurrentStep('categories');
  }

  async function handleSelfieChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    setSelfieLogoSrc(dataUrl);
  }

  async function exportReceiptImage() {
    setIsExporting(true);

    try {
      const dataUrl = await renderReceiptPng({
        backgroundSrc: pageBackgroundImage,
        logoSrc: selfieLogoSrc,
        customerName: CUSTOMER_NAME,
        businessName: BUSINESS_NAME,
        purpose: RECEIPT_PURPOSE,
        items: receiptItems,
      });
      const anchor = document.createElement('a');
      anchor.href = dataUrl;
      anchor.download = 'HBD-Smallie-Woo-2026.png';
      anchor.click();
    } finally {
      setIsExporting(false);
    }
  }

  async function handlePlayIntro() {
    if (!introVideoRef.current) {
      return;
    }

    introWasPausedByUserRef.current = false;
    shouldResumeIntroAfterBufferRef.current = false;
    setIsIntroBuffering(false);
    setShowIntroControls(false);

    try {
      await introVideoRef.current.play();
      setIsIntroPlaying(true);
    } catch {
      setIsIntroPlaying(false);
      setShowIntroControls(true);
    }
  }

  async function handleToggleIntroPlayback() {
    if (!introVideoRef.current) {
      return;
    }

    if (isIntroBuffering || introVideoRef.current.paused || introVideoRef.current.ended) {
      await handlePlayIntro();
      return;
    }

    introWasPausedByUserRef.current = true;
    shouldResumeIntroAfterBufferRef.current = false;
    setIsIntroBuffering(false);
    setShowIntroControls(true);
    introVideoRef.current.pause();
    setIsIntroPlaying(false);
  }

  function handleIntroWaiting() {
    if (!introVideoRef.current || introVideoRef.current.paused || introVideoRef.current.ended) {
      return;
    }

    shouldResumeIntroAfterBufferRef.current = true;
    setIsIntroPlaying(false);
    setIsIntroBuffering(true);
    setShowIntroControls(true);
  }

  async function handleIntroCanPlay() {
    setIsIntroBuffering(false);

    if (!introVideoRef.current || introWasPausedByUserRef.current || !shouldResumeIntroAfterBufferRef.current) {
      return;
    }

    try {
      await introVideoRef.current.play();
      setIsIntroPlaying(true);
      setShowIntroControls(false);
      shouldResumeIntroAfterBufferRef.current = false;
    } catch {
      setIsIntroPlaying(false);
      setIsIntroBuffering(true);
      setShowIntroControls(true);
    }
  }

  function handleIntroSurfaceTap() {
    if (!isIntroPlaying && !isIntroBuffering) {
      return;
    }

    setShowIntroControls((current) => !current);
  }

  function renderStepContent() {
    if (currentStep === 'memo') {
      if (showIntroGreeting) {
        return (
          <div className="intro-greeting">
            <h1>
              Happy Birthday
              <br />
              Smallie Woo.
            </h1>
            <p>
              <Heart size={18} fill="currentColor" />
              <span>Love you to the moon and back</span>
            </p>
          </div>
        );
      }

      return (
        <div className="step-layout step-layout--single step-layout--memo">
          <section className="story-card story-card--single story-card--video">
            <div
              className="intro-video-shell"
              onClick={handleIntroSurfaceTap}
              style={{
                backgroundImage: `url('${resolvedIntroPosterPath}')`,
              }}
            >
              <video
                ref={introVideoRef}
                className="intro-video"
                src={resolvedIntroVideoPath}
                playsInline
                preload="metadata"
                poster={resolvedIntroPosterPath}
                disablePictureInPicture
                controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
                onPlay={() => {
                  setIsIntroPlaying(true);
                  setIsIntroBuffering(false);
                  setShowIntroControls(false);
                }}
                onPlaying={() => {
                  setIsIntroPlaying(true);
                  setIsIntroBuffering(false);
                  setShowIntroControls(false);
                  shouldResumeIntroAfterBufferRef.current = false;
                }}
                onLoadedData={() => {
                  setIsIntroBuffering(false);
                }}
                onPause={() => {
                  setIsIntroPlaying(false);
                  setShowIntroControls(true);
                }}
                onEnded={() => {
                  setIsIntroPlaying(false);
                  setIsIntroBuffering(false);
                  setIsIntroReadyToContinue(true);
                  setShowIntroControls(true);
                  shouldResumeIntroAfterBufferRef.current = false;
                }}
                onWaiting={handleIntroWaiting}
                onStalled={handleIntroWaiting}
                onCanPlay={() => {
                  void handleIntroCanPlay();
                }}
                onCanPlayThrough={() => {
                  void handleIntroCanPlay();
                }}
                onError={() => {
                  const fallbackIntroVideoPath = resolveAssetPath(DEFAULT_INTRO_VIDEO_PATH);
                  setIsIntroPlaying(false);
                  setIsIntroBuffering(false);
                  setShowIntroControls(true);
                  shouldResumeIntroAfterBufferRef.current = false;
                  if (resolvedIntroVideoPath !== fallbackIntroVideoPath) {
                    setResolvedIntroVideoPath(fallbackIntroVideoPath);
                  }
                }}
              />
              {showIntroControls ? (
                <button
                  type="button"
                  className="intro-video-play"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleToggleIntroPlayback();
                  }}
                  aria-label={isIntroBuffering ? 'Resume intro video' : isIntroPlaying ? 'Pause intro video' : 'Play intro video'}
                >
                  {isIntroBuffering ? (
                    <LoaderCircle size={22} className="intro-video-play__spinner" />
                  ) : isIntroPlaying ? (
                    <Pause size={22} fill="currentColor" />
                  ) : (
                    <Play size={22} fill="currentColor" />
                  )}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      );
    }

    if (currentStep === 'categories') {
      return (
        <div className="step-layout step-layout--single step-layout--categories">
          <div className="category-grid category-grid--single-focus">
            {categories.map((category, index) => {
              const isActive = category.key === selectedCategoryKey;
              const isLocked = Boolean(selectedGifts[category.key]);

              return (
                <button
                  key={category.key}
                  type="button"
                  className={`category-card ${isActive ? 'is-active' : ''} ${isLocked ? 'is-locked' : ''}`.trim()}
                  onClick={() => handleOpenPane(category.key)}
                  disabled={isLocked}
                >
                  <div
                    className="category-card__media"
                    style={{
                      backgroundImage: `url('${resolveAssetPath(category.imagePath)}'), url('${resolvedIntroPosterPath}')`,
                      backgroundPosition: getAdjustedImagePosition(category.key, category.imagePosition),
                    }}
                  />
                  <div className="category-card__body" style={{ backgroundColor: CATEGORY_CARD_SHADES[index] }}>
                    <strong>{category.title}</strong>
                    {isLocked ? (
                      <span className="category-card__badge">
                        <Lock size={12} />
                        <span>{selectedGifts[category.key]?.name}</span>
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (currentStep === 'wheel') {
      return (
        <div className="step-layout step-layout--wheel">
          <div className="step-intro">
            <h1 className="step-title step-title--compact">{selectedCategory.title}</h1>
          </div>
          <section className="story-card story-card--single story-card--selector">
            <div className="selector-layout">
              <div className="wheel-stage">
                <div className="wheel-pointer" />
                <svg className={`gift-wheel ${isSpinning ? 'is-spinning' : ''}`} viewBox="0 0 320 320" aria-hidden="true">
                  <g
                    style={{
                      transform: `rotate(${wheelRotation}deg)`,
                      transformOrigin: '160px 160px',
                    }}
                  >
                    {selectedCategory.gifts.map((gift, index) => {
                      const startAngle = index * wheelSlice;
                      const endAngle = startAngle + wheelSlice;
                      const labelAngle = startAngle + wheelSlice / 2;
                      const labelPoint = polarToCartesian(160, 160, 92, labelAngle);

                      return (
                        <g key={`${gift.name}-${gift.price}`}>
                          <path d={describeArc(160, 160, 136, startAngle, endAngle)} fill={WHEEL_SEGMENT_COLORS[index % WHEEL_SEGMENT_COLORS.length]} />
                          <text
                            x={labelPoint.x}
                            y={labelPoint.y}
                            className="gift-wheel__number"
                            transform={`rotate(${labelAngle} ${labelPoint.x} ${labelPoint.y})`}
                          >
                            {index + 1}
                          </text>
                        </g>
                      );
                    })}
                    <circle cx="160" cy="160" r="30" className="gift-wheel__hub" />
                  </g>
                </svg>
                <button
                  type="button"
                  className={`wheel-hub-button ${!isSpinning && selectedCategorySpinAttempts < 2 ? 'is-ready' : ''}`.trim()}
                  onClick={handleSelectGift}
                  disabled={isSpinning || selectedCategorySpinAttempts >= 2}
                >
                  <span>
                    {isSpinning
                      ? '...'
                      : selectedCategorySpinAttempts === 0
                        ? 'Spin'
                        : selectedCategorySpinAttempts === 1
                          ? "I don't like this, Spin Again"
                          : 'Done'}
                  </span>
                </button>
              </div>
              <div className="wheel-list" aria-live="polite">
                {centeredWheelItems.map((item) => (
                  <div
                    key={`${selectedCategory.key}-${item.index}-${item.offset}`}
                    className={`wheel-list__item ${item.offset === 0 ? 'is-active' : ''}`.trim()}
                    style={
                      {
                        '--offset-distance': Math.abs(item.offset),
                      } as CSSProperties
                    }
                  >
                    <span className="wheel-list__number">{item.index + 1}</span>
                    <span className="wheel-list__gift">
                      {item.gift.name}
                      <small>EUR {item.gift.price.toFixed(2)}</small>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      );
    }

    if (currentStep === 'selfie') {
      return (
        <div className="step-layout step-layout--single step-layout--selfie">
          <section className="story-card story-card--single story-card--selfie">
            <div className="selfie-stage">
              <div className="selfie-stage__preview">
                {selfieLogoSrc ? <img src={selfieLogoSrc} alt={CUSTOMER_NAME} /> : <Camera size={48} />}
              </div>
              <div className="selfie-stage__copy">
                <h1 className="step-title step-title--compact">Add your selfie logo</h1>
                <p>This photo will sit beside Your Name on the receipt.</p>
              </div>
              <label className="upload-trigger">
                <Upload size={16} />
                <span>{selfieLogoSrc ? 'Choose another image' : 'Upload image'}</span>
                <input type="file" accept="image/*" onChange={handleSelfieChange} />
              </label>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="step-layout step-layout--single step-layout--cashout">
        <section className="story-card story-card--single story-card--receipt">
          <div className="cashout-copy">
            <h1>Cash Out</h1>
            <p>Download your receipt and send it to Bryan</p>
          </div>
          <div className="cashout-floating-note" aria-hidden="true">
            <div className="cashout-floating-note__dots">
              <span />
              <span />
              <span />
            </div>
            <div className="cashout-floating-note__copy">
              <strong>Ala Content Creator!</strong>
              <p>After your gifts are funded you’ll have to record videos of you getting them.</p>
            </div>
          </div>
          <div className="content-actions">
            <ActionButton
              label="Cash Out My Gifts"
              detail="Download receipt image"
              icon={<Download size={16} />}
              tone="primary"
              onClick={exportReceiptImage}
              disabled={!allCategoriesLocked || isExporting || !selfieLogoSrc}
            />
          </div>
        </section>
      </div>
    );
  }

  function renderFooterActions() {
    if (currentStep === 'memo') {
      return (
        <>
          <ActionButton label="Back" icon={<ArrowLeft size={16} />} tone="ghost" onClick={handleBack} disabled />
          <ActionButton
            label={!showIntroGreeting && !isIntroReadyToContinue ? 'Watch Till End' : 'Continue'}
            icon={<ArrowRight size={16} />}
            tone="primary"
            onClick={handleStartCategories}
            disabled={showIntroGreeting || !isIntroReadyToContinue}
          />
        </>
      );
  }

    if (currentStep === 'categories') {
      return (
        <>
          <ActionButton label="Back" icon={<ArrowLeft size={16} />} tone="ghost" onClick={handleBack} />
          {allCategoriesLocked ? (
            <ActionButton
              label="Continue"
              icon={<ArrowRight size={16} />}
              tone="primary"
              onClick={() => setCurrentStep('selfie')}
            />
          ) : null}
        </>
      );
    }

    if (currentStep === 'wheel') {
      return (
        <>
          <ActionButton label="Back" icon={<ArrowLeft size={16} />} tone="ghost" onClick={handleBack} disabled={isSpinning} />
          <ActionButton
            label="I Like This, Continue"
            icon={<ArrowRight size={16} />}
            tone="primary"
            onClick={handleAdvanceFromWheel}
            disabled={!selectedGift}
          />
        </>
      );
    }

    if (currentStep === 'selfie') {
      return (
        <>
          <ActionButton label="Back" icon={<ArrowLeft size={16} />} tone="ghost" onClick={handleBack} />
          <ActionButton
            label="Continue"
            icon={<ArrowRight size={16} />}
            tone="primary"
            onClick={() => setCurrentStep('cashout')}
            disabled={!selfieLogoSrc}
          />
        </>
      );
    }

    return null;
  }

  return (
    <div className="experience-root">
      <div className="scene-stage">
        <section
          className={`experience-shell experience-shell--${currentStep} ${
            currentStep === 'memo' && showIntroGreeting ? 'experience-shell--intro-greeting' : ''
          }`.trim()}
          style={
            currentStep === 'memo' && showIntroGreeting
              ? {
                  background: `url("${pageBackgroundImage}") center center / cover no-repeat`,
                }
              : undefined
          }
        >
          <div className="experience-content">{renderStepContent()}</div>
          {currentStep === 'cashout' || (currentStep === 'memo' && showIntroGreeting) ? null : (
            <footer className="experience-footer">{renderFooterActions()}</footer>
          )}
        </section>
      </div>
    </div>
  );
}

function AdminStudio() {
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState('');
  const [saveNote, setSaveNote] = useState('');
  const [config, setConfig] = useState<ExperienceConfig>(() => loadExperienceConfig());
  const [adminStepIndex, setAdminStepIndex] = useState(0);

  const adminSteps = useMemo(
    () => [
      {
        id: 'intro-video',
        title: 'Intro video',
        kind: 'video' as const,
      },
      ...config.categories.map((category) => ({
        id: category.key,
        title: category.title,
        kind: 'category' as const,
        category,
      })),
      {
        id: 'finish',
        title: 'Save and export',
        kind: 'finish' as const,
      },
    ],
    [config.categories],
  );
  const activeAdminStep = adminSteps[adminStepIndex] ?? adminSteps[0];
  const isFirstAdminStep = adminStepIndex === 0;
  const isLastAdminStep = adminStepIndex === adminSteps.length - 1;

  useEffect(() => {
    if (window.sessionStorage.getItem('birthday-admin-unlocked') === 'yes') {
      setUnlocked(true);
    }
  }, []);

  useEffect(() => {
    if (adminStepIndex > adminSteps.length - 1) {
      setAdminStepIndex(adminSteps.length - 1);
    }
  }, [adminStepIndex, adminSteps.length]);

  function handleUnlock() {
    if (password !== ADMIN_PASSWORD) {
      setError('Wrong password.');
      return;
    }

    setUnlocked(true);
    setError('');
    window.sessionStorage.setItem('birthday-admin-unlocked', 'yes');
  }

  function updateCategory(categoryKey: CategoryKey, updater: (category: ExperienceCategoryConfig) => ExperienceCategoryConfig) {
    setConfig((current) => ({
      ...current,
      categories: current.categories.map((category) => (category.key === categoryKey ? updater(category) : category)),
    }));
    setSaveNote('');
  }

  function handleVideoPathChange(value: string) {
    setConfig((current) => ({
      ...current,
      introVideoPath: value,
    }));
    setSaveNote('');
  }

  function handleVideoFilePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    handleVideoPathChange(getPickedFilePath(file, event.target));
  }

  function handleCategoryImagePathChange(categoryKey: CategoryKey, value: string) {
    updateCategory(categoryKey, (category) => ({
      ...category,
      imagePath: value,
    }));
  }

  function handleCategoryImageFilePick(categoryKey: CategoryKey, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    handleCategoryImagePathChange(categoryKey, getPickedFilePath(file, event.target));
  }

  function handleCategoryGiftTextChange(categoryKey: CategoryKey, value: string) {
    updateCategory(categoryKey, (category) => ({
      ...category,
      gifts: parseGiftLines(value),
    }));
  }

  function handleSaveConfig() {
    saveExperienceConfig(config);
    setSaveNote('Saved. The public page will use these values on refresh.');
    setError('');
  }

  function handleResetConfig() {
    const nextConfig = createDefaultExperienceConfig();
    setConfig(nextConfig);
    saveExperienceConfig(nextConfig);
    setSaveNote('Reset back to the default gifts and paths.');
    setError('');
  }

  function handleExportTxt() {
    const exportText = `Paste this config into TRAE and ask it to apply the values and copy the referenced assets into the repo.\n\n${serializeExperienceConfig(
      config,
    )}`;
    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'birthday-experience-config.txt';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function goToNextAdminStep() {
    setAdminStepIndex((current) => Math.min(current + 1, adminSteps.length - 1));
  }

  function goToPreviousAdminStep() {
    setAdminStepIndex((current) => Math.max(current - 1, 0));
  }

  if (!unlocked) {
    return (
      <div className="admin-root">
        <div className="admin-card">
          <Lock size={20} />
          <h1>Gift studio</h1>
          <input
            type="password"
            value={password}
            placeholder="Password"
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="button" onClick={handleUnlock}>
            Unlock
          </button>
          {error ? <p>{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-root">
      <div className="admin-card admin-card--wide">
        <h1>Gift studio</h1>
        <p className="admin-note">Set the intro video path, category image paths, and each gift with its price. Move through the steps, then save and export when you are done.</p>

        <div className="admin-stepper" aria-label="Gift studio steps">
          {adminSteps.map((step, index) => (
            <button
              key={step.id}
              type="button"
              className={`admin-stepper__item ${index === adminStepIndex ? 'is-active' : ''}`.trim()}
              onClick={() => setAdminStepIndex(index)}
            >
              <span className="admin-stepper__count">{index + 1}</span>
              <span className="admin-stepper__label">{step.title}</span>
            </button>
          ))}
        </div>

        <section key={activeAdminStep.id} className="admin-section admin-section--step">
          <div className="admin-section__heading">
            <p className="admin-section__eyebrow">
              Step {adminStepIndex + 1} of {adminSteps.length}
            </p>
            <h2>{activeAdminStep.title}</h2>
          </div>

          {activeAdminStep.kind === 'video' ? (
            <div className="admin-grid">
              <label className="admin-field">
                <span>Selected file path</span>
                <input
                  type="text"
                  value={config.introVideoPath}
                  onChange={(event) => handleVideoPathChange(event.target.value)}
                  placeholder="Select a local video file"
                />
              </label>
              <label className="admin-field">
                <span>Pick video file</span>
                <input key="admin-video-file" type="file" accept="video/*" onChange={handleVideoFilePick} />
              </label>
            </div>
          ) : null}

          {activeAdminStep.kind === 'category' ? (
            <>
              <div className="admin-grid">
                <label className="admin-field">
                  <span>Selected file path</span>
                  <input
                    type="text"
                    value={activeAdminStep.category.imagePath}
                    onChange={(event) => handleCategoryImagePathChange(activeAdminStep.category.key, event.target.value)}
                    placeholder="Select a local image file"
                  />
                </label>
                <label className="admin-field">
                  <span>Pick image file</span>
                  <input
                    key={`admin-image-file-${activeAdminStep.category.key}`}
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleCategoryImageFilePick(activeAdminStep.category.key, event)}
                  />
                </label>
              </div>
              <label className="admin-field">
                <span>Gift list with prices</span>
                <textarea
                  rows={8}
                  value={giftLinesToText(activeAdminStep.category.gifts)}
                  onChange={(event) => handleCategoryGiftTextChange(activeAdminStep.category.key, event.target.value)}
                  placeholder="Gift name | 31"
                />
              </label>
            </>
          ) : null}

          {activeAdminStep.kind === 'finish' ? (
            <>
              <p className="admin-note">Save the values for local use, export the txt file when you want me to bake the latest text and file paths into the repo, or reset everything back to default.</p>
              <div className="admin-actions">
                <button type="button" onClick={handleSaveConfig}>
                  <Save size={16} />
                  <span>Save values</span>
                </button>
                <button type="button" onClick={handleExportTxt}>
                  <Download size={16} />
                  <span>Export txt</span>
                </button>
                <button type="button" onClick={handleResetConfig}>
                  <RotateCcw size={16} />
                  <span>Reset defaults</span>
                </button>
              </div>
            </>
          ) : null}
        </section>

        <div className="admin-nav">
          <button type="button" className="admin-nav__button admin-nav__button--ghost" onClick={goToPreviousAdminStep} disabled={isFirstAdminStep}>
            <ArrowLeft size={16} />
            <span>Previous</span>
          </button>
          <button type="button" className="admin-nav__button" onClick={goToNextAdminStep} disabled={isLastAdminStep}>
            <span>Next</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {error ? <p>{error}</p> : null}
        {saveNote ? <p className="admin-note admin-note--success">{saveNote}</p> : null}
      </div>
    </div>
  );
}

export default function App() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentUiAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentUiAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const currentUiAudioGainRef = useRef<GainNode | null>(null);
  const currentUiAudioCleanupRef = useRef<(() => void) | null>(null);
  const remainingUiSoundPathsRef = useRef<string[]>([]);
  const audioIndicatorTimeoutRef = useRef<number | null>(null);
  const [audioIndicatorCorner, setAudioIndicatorCorner] = useState<AudioIndicatorCorner>('top-right');
  const [audioIndicatorAvatarSrc, setAudioIndicatorAvatarSrc] = useState<string | null>(null);
  const [isAudioIndicatorVisible, setIsAudioIndicatorVisible] = useState(false);
  const [isAudioIndicatorLeaving, setIsAudioIndicatorLeaving] = useState(false);
  const showAdminStudio = isAdminRoute();
  const pageBackgroundImage = resolveAssetPath(PAGE_BACKGROUND_PATH);
  const audioIndicatorImagePool = useMemo(
    () => AUDIO_INDICATOR_AVATAR_PATHS.map((path) => resolveAssetPath(path)),
    [],
  );

  useEffect(() => {
    document.documentElement.style.setProperty('--page-background-image', `url("${pageBackgroundImage}")`);

    return () => {
      document.documentElement.style.removeProperty('--page-background-image');
    };
  }, [pageBackgroundImage]);

  useEffect(() => {
    return () => {
      if (audioIndicatorTimeoutRef.current !== null) {
        window.clearTimeout(audioIndicatorTimeoutRef.current);
      }
      currentUiAudioCleanupRef.current?.();
      currentUiAudioRef.current?.pause();
      currentUiAudioSourceRef.current?.disconnect();
      currentUiAudioGainRef.current?.disconnect();
      currentUiAudioRef.current = null;
      currentUiAudioSourceRef.current = null;
      currentUiAudioGainRef.current = null;
    };
  }, []);

  function clearAudioIndicatorTimeout() {
    if (audioIndicatorTimeoutRef.current !== null) {
      window.clearTimeout(audioIndicatorTimeoutRef.current);
      audioIndicatorTimeoutRef.current = null;
    }
  }

  function showAudioIndicator() {
    clearAudioIndicatorTimeout();
    setAudioIndicatorCorner(AUDIO_INDICATOR_CORNERS[Math.floor(Math.random() * AUDIO_INDICATOR_CORNERS.length)] ?? 'top-right');
    setAudioIndicatorAvatarSrc(
      audioIndicatorImagePool[Math.floor(Math.random() * audioIndicatorImagePool.length)] ?? resolveAssetPath('/images/birthday-bg.jpg'),
    );
    setIsAudioIndicatorLeaving(false);
    setIsAudioIndicatorVisible(true);
  }

  function hideAudioIndicator() {
    clearAudioIndicatorTimeout();
    setIsAudioIndicatorLeaving(true);
    audioIndicatorTimeoutRef.current = window.setTimeout(() => {
      setIsAudioIndicatorVisible(false);
      setIsAudioIndicatorLeaving(false);
      audioIndicatorTimeoutRef.current = null;
    }, 260);
  }

  function getNextUiSoundPath() {
    if (remainingUiSoundPathsRef.current.length === 0) {
      remainingUiSoundPathsRef.current = [...UI_SOUND_PATHS];
    }

    const nextIndex = Math.floor(Math.random() * remainingUiSoundPathsRef.current.length);
    const [nextSoundPath] = remainingUiSoundPathsRef.current.splice(nextIndex, 1);
    return resolveAssetPath(nextSoundPath ?? UI_SOUND_PATHS[0]);
  }

  async function playRandomUiSound() {
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    currentUiAudioCleanupRef.current?.();
    currentUiAudioCleanupRef.current = null;
    currentUiAudioRef.current?.pause();
    currentUiAudioSourceRef.current?.disconnect();
    currentUiAudioGainRef.current?.disconnect();

    const nextSoundPath = getNextUiSoundPath();
    const nextAudio = new Audio(nextSoundPath);
    const nextSource = audioContextRef.current.createMediaElementSource(nextAudio);
    const nextGain = audioContextRef.current.createGain();
    nextGain.gain.value = getGainMultiplierFromDb(getGainDbFromAudioPath(nextSoundPath));
    nextSource.connect(nextGain);
    nextGain.connect(audioContextRef.current.destination);

    const cleanupAudio = () => {
      nextAudio.removeEventListener('ended', cleanupAudio);
      nextAudio.removeEventListener('error', cleanupAudio);
      nextSource.disconnect();
      nextGain.disconnect();

      if (currentUiAudioRef.current === nextAudio) {
        currentUiAudioRef.current = null;
        currentUiAudioSourceRef.current = null;
        currentUiAudioGainRef.current = null;
      }

      if (currentUiAudioCleanupRef.current === cleanupAudio) {
        currentUiAudioCleanupRef.current = null;
      }

      hideAudioIndicator();
    };

    nextAudio.addEventListener('ended', cleanupAudio, { once: true });
    nextAudio.addEventListener('error', cleanupAudio, { once: true });

    currentUiAudioRef.current = nextAudio;
    currentUiAudioSourceRef.current = nextSource;
    currentUiAudioGainRef.current = nextGain;
    currentUiAudioCleanupRef.current = cleanupAudio;

    try {
      showAudioIndicator();
      await nextAudio.play();
    } catch {
      cleanupAudio();
    }
  }

  function handleButtonClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    const button = target?.closest('button');
    if (!button || button.hasAttribute('disabled')) {
      return;
    }

    void playRandomUiSound();
  }

  return (
    <div onClickCapture={handleButtonClickCapture}>
      {showAdminStudio ? <AdminStudio /> : <PublicExperience pageBackgroundImage={pageBackgroundImage} />}
      {isAudioIndicatorVisible || isAudioIndicatorLeaving ? (
        <div
          className={`audio-activity-pill audio-activity-pill--${audioIndicatorCorner} ${
            isAudioIndicatorLeaving ? 'is-leaving' : 'is-visible'
          }`.trim()}
          aria-hidden="true"
        >
          {audioIndicatorAvatarSrc ? (
            <span className="audio-activity-pill__avatar">
              <img src={audioIndicatorAvatarSrc} alt="" />
            </span>
          ) : null}
          <span className="audio-activity-pill__bars">
            <span />
            <span />
            <span />
          </span>
        </div>
      ) : null}
    </div>
  );
}
