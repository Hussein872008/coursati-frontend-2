import React, { useState, useRef } from 'react';

const CloudinaryPdfInput = ({ 
	value, 
	onChange, 
	label = 'Upload PDF',
	placeholder = 'Click to upload PDF',
	required = false
}) => {
	const [fileInfo, setFileInfo] = useState(null);
	const [loading, setLoading] = useState(false);
	const fileInputRef = useRef(null);

	const handleFileSelect = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (file.type !== 'application/pdf') {
			alert('الرجاء اختيار ملف PDF');
			return;
		}

		setFileInfo({
			name: file.name,
			size: file.size,
		});

		onChange(file);
	};

	const handleRemove = () => {
		setFileInfo(null);
		onChange(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
	};

	const formatFileSize = (bytes) => {
		if (!bytes) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
	};

	return (
		<div className="space-y-2">
			<label className="block text-sm font-medium text-gray-700">
				{label}
				{required && <span className="text-red-500 ml-1">*</span>}
			</label>

			{fileInfo && (
				<div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-200">
					<div className="flex items-center space-x-3">
						<div className="text-2xl">📄</div>
						<div>
							<p className="text-sm font-medium text-gray-900">{fileInfo.name}</p>
							{fileInfo.size && (
								<p className="text-xs text-gray-600">{formatFileSize(fileInfo.size)}</p>
							)}
						</div>
					</div>
					<button
						type="button"
						onClick={handleRemove}
						className="text-red-500 hover:text-red-600 font-bold"
					>
						✕
					</button>
				</div>
			)}

			<input
				ref={fileInputRef}
				type="file"
				accept=".pdf,application/pdf"
				onChange={handleFileSelect}
				className="hidden"
			/>

			<button
				type="button"
				onClick={() => fileInputRef.current?.click()}
				disabled={loading}
				className="w-full px-4 py-2 border-2 border-dashed border-blue-400 rounded-lg hover:border-blue-600 disabled:border-gray-300 disabled:cursor-not-allowed transition-colors text-blue-600 font-medium disabled:text-gray-400"
			>
				{loading ? 'جاري الرفع...' : fileInfo ? 'تغيير PDF' : 'رفع PDF'}
			</button>
		</div>
	);
};

export default CloudinaryPdfInput;
