import React from 'react';
import { Slide } from '@mui/material';

// Safe transition component that prevents scrollTop errors
const SafeTransition = React.forwardRef(function SafeTransition(props, ref) {
    // Ensure the component is mounted and DOM is ready
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(timer);
    }, []);

    return <Slide
        direction="up"
        ref={ref}
        {...props}
        in={mounted && props.in}
        mountOnEnter
        unmountOnExit
    />;
});

export default SafeTransition; 