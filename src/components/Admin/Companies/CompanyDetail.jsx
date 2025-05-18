import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Chip,
    Button,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
} from '@mui/material';
import {
    Business as BusinessIcon,
    Email as EmailIcon,
    Phone as PhoneIcon,
    LocationOn as LocationIcon,
    Edit as EditIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/firebase';
import { format } from 'date-fns';
import './CompanyDetail.css';

const CompanyDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [company, setCompany] = useState(null);
    const [mainContact, setMainContact] = useState(null);
    const [origins, setOrigins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadCompanyData = async () => {
            try {
                // Load company details
                const companyDoc = await getDoc(doc(db, 'companies', id));
                if (!companyDoc.exists()) {
                    throw new Error('Company not found');
                }
                setCompany({ id: companyDoc.id, ...companyDoc.data() });

                // Load main contact
                const addressBookRef = collection(db, 'addressBook');
                const mainContactQuery = query(
                    addressBookRef,
                    where('addressClass', '==', 'company'),
                    where('addressClassID', '==', companyDoc.data().companyID),
                    where('addressType', '==', 'contact')
                );
                const mainContactSnapshot = await getDocs(mainContactQuery);
                if (!mainContactSnapshot.empty) {
                    setMainContact({ id: mainContactSnapshot.docs[0].id, ...mainContactSnapshot.docs[0].data() });
                }

                // Load origins
                const originsQuery = query(
                    addressBookRef,
                    where('addressClass', '==', 'company'),
                    where('addressClassID', '==', companyDoc.data().companyID),
                    where('addressType', '==', 'origin')
                );
                const originsSnapshot = await getDocs(originsQuery);
                const originsData = originsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setOrigins(originsData);

                setLoading(false);
            } catch (err) {
                console.error('Error loading company data:', err);
                setError(err.message);
                setLoading(false);
            }
        };

        loadCompanyData();
    }, [id]);

    if (loading) {
        return <Box className="admin-company-detail">Loading...</Box>;
    }

    if (error) {
        return <Box className="admin-company-detail">Error: {error}</Box>;
    }

    if (!company) {
        return <Box className="admin-company-detail">Company not found</Box>;
    }

    return (
        <Box className="admin-company-detail">
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" component="h1" gutterBottom>
                        {company.name}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Company ID: {company.companyID}
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<EditIcon />}
                    onClick={() => navigate(`/admin/companies/${id}/edit`)}
                >
                    Edit Company
                </Button>
            </Box>

            <Grid container spacing={3}>
                {/* Company Information */}
                <Grid item xs={12} md={6}>
                    <Paper className="detail-section">
                        <Typography variant="h6" className="section-title">
                            Company Information
                        </Typography>
                        <List>
                            <ListItem>
                                <ListItemIcon>
                                    <BusinessIcon />
                                </ListItemIcon>
                                <ListItemText
                                    primary="Status"
                                    secondary={
                                        <Chip
                                            label={company.status}
                                            size="small"
                                            sx={{
                                                backgroundColor: company.status === 'active' ? '#f1f8f5' : '#f9fafb',
                                                color: company.status === 'active' ? '#0a875a' : '#637381',
                                            }}
                                        />
                                    }
                                />
                            </ListItem>
                            <ListItem>
                                <ListItemIcon>
                                    <BusinessIcon />
                                </ListItemIcon>
                                <ListItemText
                                    primary="Created At"
                                    secondary={company.createdAt ? format(company.createdAt.toDate(), 'MMM d, yyyy') : 'N/A'}
                                />
                            </ListItem>
                            <ListItem>
                                <ListItemIcon>
                                    <BusinessIcon />
                                </ListItemIcon>
                                <ListItemText
                                    primary="Updated At"
                                    secondary={company.updatedAt ? format(company.updatedAt.toDate(), 'MMM d, yyyy') : 'N/A'}
                                />
                            </ListItem>
                        </List>
                    </Paper>
                </Grid>

                {/* Main Contact */}
                <Grid item xs={12} md={6}>
                    <Paper className="detail-section">
                        <Typography variant="h6" className="section-title">
                            Main Contact
                        </Typography>
                        {mainContact ? (
                            <List>
                                <ListItem>
                                    <ListItemIcon>
                                        <BusinessIcon />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Contact Name"
                                        secondary={`${mainContact.firstName} ${mainContact.lastName}`}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemIcon>
                                        <EmailIcon />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Email"
                                        secondary={mainContact.email}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemIcon>
                                        <PhoneIcon />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Phone"
                                        secondary={mainContact.phone}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemIcon>
                                        <LocationIcon />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Address"
                                        secondary={
                                            <>
                                                {mainContact.address1}
                                                {mainContact.address2 && <>, {mainContact.address2}</>}
                                                <br />
                                                {mainContact.city}, {mainContact.stateProv} {mainContact.zipPostal}
                                                <br />
                                                {mainContact.country}
                                            </>
                                        }
                                    />
                                </ListItem>
                            </List>
                        ) : (
                            <Typography color="text.secondary">No main contact information available</Typography>
                        )}
                    </Paper>
                </Grid>

                {/* Origin Addresses */}
                <Grid item xs={12}>
                    <Paper className="detail-section">
                        <Typography variant="h6" className="section-title">
                            Origin Addresses
                        </Typography>
                        {origins.length > 0 ? (
                            <Grid container spacing={2}>
                                {origins.map((origin) => (
                                    <Grid item xs={12} md={6} key={origin.id}>
                                        <Paper className="origin-card">
                                            <Typography variant="subtitle1" gutterBottom>
                                                {origin.nickname}
                                            </Typography>
                                            <List dense>
                                                <ListItem>
                                                    <ListItemIcon>
                                                        <BusinessIcon />
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary="Contact Name"
                                                        secondary={`${origin.firstName} ${origin.lastName}`}
                                                    />
                                                </ListItem>
                                                <ListItem>
                                                    <ListItemIcon>
                                                        <EmailIcon />
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary="Email"
                                                        secondary={origin.email}
                                                    />
                                                </ListItem>
                                                <ListItem>
                                                    <ListItemIcon>
                                                        <PhoneIcon />
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary="Phone"
                                                        secondary={origin.phone}
                                                    />
                                                </ListItem>
                                                <ListItem>
                                                    <ListItemIcon>
                                                        <LocationIcon />
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary="Address"
                                                        secondary={
                                                            <>
                                                                {origin.address1}
                                                                {origin.address2 && <>, {origin.address2}</>}
                                                                <br />
                                                                {origin.city}, {origin.stateProv} {origin.zipPostal}
                                                                <br />
                                                                {origin.country}
                                                            </>
                                                        }
                                                    />
                                                </ListItem>
                                            </List>
                                        </Paper>
                                    </Grid>
                                ))}
                            </Grid>
                        ) : (
                            <Typography color="text.secondary">No origin addresses available</Typography>
                        )}
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default CompanyDetail; 