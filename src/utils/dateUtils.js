import { format } from 'date-fns';
 
export const formatDateString = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    return format(timestamp.toDate(), 'MMM d, yyyy p');
}; 