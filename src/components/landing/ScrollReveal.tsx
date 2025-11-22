'use client';

import { motion, useInView, type UseInViewOptions } from 'framer-motion';
import { useRef, ReactNode } from 'react';

interface ScrollRevealProps {
    children: ReactNode;
    width?: 'fit-content' | '100%';
    delay?: number;
    duration?: number;
    yOffset?: number;
    threshold?: number;
    className?: string;
}

export default function ScrollReveal({
    children,
    width = 'fit-content',
    delay = 0,
    duration = 0.5,
    yOffset = 50,
    threshold = 0.1,
    className = '',
}: ScrollRevealProps) {
    const ref = useRef(null);
    // framer-motion's types constrain margin to px patterns; allow % via a narrow cast helper
    const asRootMargin = (m: string) => m as unknown as UseInViewOptions['margin'];
    const rootMargin = asRootMargin(`0px 0px -${threshold * 100}% 0px`);
    const isInView = useInView(ref, { once: true, margin: rootMargin });

    return (
        <div ref={ref} style={{ width }} className={className}>
            <motion.div
                variants={{
                    hidden: { opacity: 0, y: yOffset },
                    visible: { opacity: 1, y: 0 },
                }}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
                transition={{ duration, delay, ease: "easeOut" }}
            >
                {children}
            </motion.div>
        </div>
    );
}
