import React, { useEffect, useRef } from 'react';

const CloudinaryUploadWidget = ({ onSuccess, onError, resourceType = 'image' }) => {
	const widgetRef = useRef(null);

	useEffect(() => {
		const script = document.createElement('script');
		script.src = 'https://upload-widget.cloudinary.com/latest/global/all.js';
		script.async = true;
		document.body.appendChild(script);

		script.onload = () => {
			if (window.cloudinary) {
				const myWidget = window.cloudinary.createUploadWidget(
					{
						cloudName: 'coursati',
						uploadPreset: 'coursati_upload',
						folder: 'coursati/',
						resourceType: resourceType,
						maxFileSize: 10000000,
						multiple: false,
						showAdvancedOptions: false,
						cropping: false,
						defaultSource: 'local',
						styles: {
							palette: {
								window: '#FFFFFF',
								windowBorder: '#90E0EF',
								tabIcon: '#0096C7',
								menuIcons: '#5A5A5A',
								textDark: '#000000',
								textLight: '#FFFFFF',
								link: '#0084FF',
								action: '#FF620D',
								inactiveTabIcon: '#B3B3B3',
								error: '#F42112',
								inProgress: '#0084FF',
								complete: '#20B938',
								sourceBg: '#E7E7E7'
							},
							fonts: {
								default: null,
								"'Droid Sans', sans-serif": {
									url: 'https://fonts.googleapis.com/css?family=Droid+Sans',
									active: true
								}
							}
						}
					},
					(error, result) => {
						if (!error && result && result.event === 'success') {
							onSuccess(result.info.secure_url);
						} else if (error) {
							// Upload error (handled by UI)
							onError(error.message || 'حدث خطأ في التحميل');
						}
					}
				);

				widgetRef.current = myWidget;
			}
		};

		return () => {
			if (script.parentNode) {
				script.parentNode.removeChild(script);
			}
		};
	}, [onSuccess, onError, resourceType]);

	const handleClick = () => {
		if (widgetRef.current) {
			widgetRef.current.open();
		}
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded"
		>
			📸 رفع صورة
		</button>
	);
};

export default CloudinaryUploadWidget;
