import type { ImageMetadata } from 'astro';
import betina from '../assets/projects/betina.webp';
import dakodev from '../assets/projects/dakodev.webp';
import legacy from '../assets/projects/legacy.webp';
import quantarax from '../assets/projects/quantarax.webp';
import rodri from '../assets/projects/rodri.webp';
import type { Slug } from '../i18n/projects';

export const posters: Record<Slug, ImageMetadata> = { legacy, dakodev, betina, quantarax, rodri };
