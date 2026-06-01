'use client';

import { useState } from 'react';

import Image from 'next/image';

import styles from './Captain.module.scss';

type CaptainPose =
  | 'hero'
  | 'welcome'
  | 'thinking'
  | 'thumbsup'
  | 'concerned'
  | 'clipboard';

const DIVERSE_PILOTS = [
  '/mascot/pilots/pilot-black-man.png',
  '/mascot/pilots/pilot-black-woman.png',
  '/mascot/pilots/pilot-asian-woman.png',
  '/mascot/pilots/pilot-south-asian-man.png',
  '/mascot/pilots/pilot-latina-woman.png',
  '/mascot/pilots/pilot-middle-eastern-man.png',
  '/mascot/pilots/pilot-pacific-islander-woman.png',
  '/mascot/pilots/pilot-white-man.png',
  '/mascot/pilots/pilot-older-black-woman.png',
  '/mascot/pilots/pilot-young-asian-man.png',
];

interface CaptainProps {
  pose?: CaptainPose;
  diverse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  alt?: string;
  className?: string;
}

const SIZES = { sm: 80, md: 160, lg: 320 };

export default function Captain({
  pose,
  diverse = false,
  size = 'md',
  alt = 'Captain PolicyPilot',
  className,
}: CaptainProps) {
  const [pilotIndex] = useState(() =>
    Math.floor(Math.random() * DIVERSE_PILOTS.length),
  );

  const px = SIZES[size];

  const src =
    diverse || !pose
      ? DIVERSE_PILOTS[pilotIndex]
      : `/mascot/captain-${pose}.png`;

  return (
    <div className={`${styles.captain} ${styles[size]} ${className ?? ''}`}>
      <Image
        src={src}
        alt={alt}
        width={px}
        height={px}
        priority={pose === 'hero' || diverse}
      />
    </div>
  );
}
