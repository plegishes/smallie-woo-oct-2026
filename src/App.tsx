import { ArrowLeft, ArrowRight, Camera, Download, Heart, Lock, Play, RotateCcw, Save, Upload } from 'lucide-react';
import { toPng } from 'html-to-image';
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
import { ReceiptImage, type ReceiptItem } from './receipt-image';
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

type ExperienceStep = 'memo' | 'categories' | 'wheel' | 'selfie' | 'cashout';

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
  const base = import.meta.env.BASE_URL || '/';

  if (base === './') {
    return `./${normalizedPath}`;
  }

  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${normalizedPath}`;
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

function PublicExperience() {
  const [experienceConfig] = useState<ExperienceConfig>(() => loadExperienceConfig());
  const categories = experienceConfig.categories;
  const [currentStep, setCurrentStep] = useState<ExperienceStep>('memo');
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<CategoryKey>('likeDontNeed');
  const [selectedGifts, setSelectedGifts] = useState<Record<CategoryKey, GiftOption | null>>(() => createGiftState(categories));
  const [spinAttempts, setSpinAttempts] = useState<Record<CategoryKey, number>>(() => createSpinAttemptState(categories));
  const [isSpinning, setIsSpinning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isIntroPlaying, setIsIntroPlaying] = useState(false);
  const [isIntroReadyToContinue, setIsIntroReadyToContinue] = useState(false);
  const [showIntroGreeting, setShowIntroGreeting] = useState(true);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [selfieLogoSrc, setSelfieLogoSrc] = useState<string | null>(null);
  const [resolvedIntroVideoPath, setResolvedIntroVideoPath] = useState(() => resolveAssetPath(experienceConfig.introVideoPath));
  const resolvedIntroPosterPath = useMemo(() => resolveAssetPath(experienceConfig.introPosterPath), [experienceConfig.introPosterPath]);
  const introVideoRef = useRef<HTMLVideoElement | null>(null);
  const wheelAnimationFrameRef = useRef<number | null>(null);
  const wheelRotationRef = useRef(0);
  const receiptRef = useRef<HTMLDivElement | null>(null);

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
  const activeWheelIndex =
    wheelGiftCount === 0
      ? 0
      : isSpinning
        ? getActiveIndexFromRotation(wheelRotation, wheelSlice, wheelGiftCount)
        : selectedGiftIndex >= 0
          ? selectedGiftIndex
          : getActiveIndexFromRotation(wheelRotation, wheelSlice, wheelGiftCount);
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
    const randomIndex = Math.floor(Math.random() * gifts.length);
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
      setSelectedGifts((current) => ({
        ...current,
        [selectedCategoryKey]: gifts[randomIndex],
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
    if (!receiptRef.current) {
      return;
    }

    setIsExporting(true);

    try {
      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 2.4,
        backgroundColor: '#1f66ff',
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

    try {
      await introVideoRef.current.play();
      setIsIntroPlaying(true);
    } catch {
      setIsIntroPlaying(false);
    }
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
                onPlay={() => setIsIntroPlaying(true)}
                onPause={() => setIsIntroPlaying(false)}
                onEnded={() => {
                  setIsIntroPlaying(false);
                  setIsIntroReadyToContinue(true);
                }}
                onError={() => {
                  const fallbackIntroVideoPath = resolveAssetPath(DEFAULT_INTRO_VIDEO_PATH);
                  if (resolvedIntroVideoPath !== fallbackIntroVideoPath) {
                    setResolvedIntroVideoPath(fallbackIntroVideoPath);
                  }
                }}
              />
              {!isIntroPlaying ? (
                <button type="button" className="intro-video-play" onClick={handlePlayIntro} aria-label="Play intro video">
                  <Play size={22} fill="currentColor" />
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
                <span>{selfieLogoSrc ? 'Choose another selfie' : 'Take or upload selfie'}</span>
                <input type="file" accept="image/*" capture="user" onChange={handleSelfieChange} />
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
            label="Continue"
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
        >
          <div className="experience-content">{renderStepContent()}</div>
          {currentStep === 'cashout' || (currentStep === 'memo' && showIntroGreeting) ? null : (
            <footer className="experience-footer">{renderFooterActions()}</footer>
          )}
        </section>
      </div>
      <div className="receipt-export-holder" aria-hidden="true">
        <ReceiptImage
          ref={receiptRef}
          customerName={CUSTOMER_NAME}
          businessName={BUSINESS_NAME}
          purpose={RECEIPT_PURPOSE}
          logoSrc={selfieLogoSrc}
          items={receiptItems}
        />
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
  const showAdminStudio = isAdminRoute();

  useEffect(() => {
    document.documentElement.style.setProperty('--page-background-image', `url("${resolveAssetPath(PAGE_BACKGROUND_PATH)}")`);

    return () => {
      document.documentElement.style.removeProperty('--page-background-image');
    };
  }, []);

  useEffect(() => {
    return () => {
      currentUiAudioRef.current?.pause();
      currentUiAudioSourceRef.current?.disconnect();
      currentUiAudioGainRef.current?.disconnect();
      currentUiAudioRef.current = null;
      currentUiAudioSourceRef.current = null;
      currentUiAudioGainRef.current = null;
    };
  }, []);

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

    currentUiAudioRef.current?.pause();
    currentUiAudioSourceRef.current?.disconnect();
    currentUiAudioGainRef.current?.disconnect();

    const nextSoundPath = resolveAssetPath(UI_SOUND_PATHS[Math.floor(Math.random() * UI_SOUND_PATHS.length)]);
    const nextAudio = new Audio(nextSoundPath);
    const nextSource = audioContextRef.current.createMediaElementSource(nextAudio);
    const nextGain = audioContextRef.current.createGain();
    nextGain.gain.value = getGainMultiplierFromDb(getGainDbFromAudioPath(nextSoundPath));
    nextSource.connect(nextGain);
    nextGain.connect(audioContextRef.current.destination);

    nextAudio.addEventListener(
      'ended',
      () => {
        nextSource.disconnect();
        nextGain.disconnect();
        if (currentUiAudioRef.current === nextAudio) {
          currentUiAudioRef.current = null;
          currentUiAudioSourceRef.current = null;
          currentUiAudioGainRef.current = null;
        }
      },
      { once: true },
    );

    currentUiAudioRef.current = nextAudio;
    currentUiAudioSourceRef.current = nextSource;
    currentUiAudioGainRef.current = nextGain;

    try {
      await nextAudio.play();
    } catch {
      nextSource.disconnect();
      nextGain.disconnect();
      if (currentUiAudioRef.current === nextAudio) {
        currentUiAudioRef.current = null;
        currentUiAudioSourceRef.current = null;
        currentUiAudioGainRef.current = null;
      }
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
      {showAdminStudio ? <AdminStudio /> : <PublicExperience />}
    </div>
  );
}
